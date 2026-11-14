-- Disable the order management UI and revoke these RPC grants to roll back access.
-- Retain order history and private details. Do not restore the old unrestricted RPC.

-- Existing orders may have been cancelled and reopened before history existed.
-- Leave them ineligible until a trusted operator verifies their stock history.
alter table public.orders add column if not exists stock_restore_eligible boolean not null default false;
alter table public.orders alter column stock_restore_eligible set default true;

create table if not exists public.order_admin_details (
  order_id uuid primary key references public.orders(id) on delete cascade,
  internal_note text check (internal_note is null or char_length(internal_note) <= 5000),
  shipping_provider text check (shipping_provider is null or char_length(shipping_provider) <= 120),
  tracking_number text check (tracking_number is null or char_length(tracking_number) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.order_admin_details enable row level security;
revoke all on public.order_admin_details from public, anon, authenticated;
grant select on public.order_admin_details to authenticated;
drop policy if exists "Admins read order details" on public.order_admin_details;
create policy "Admins read order details" on public.order_admin_details for select to authenticated
  using ((select public.is_active_admin()));

-- The previous function permits arbitrary status changes, bypassing stock safety.
revoke execute on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon, authenticated;

create or replace function public.admin_transition_order(
  p_order_id uuid, p_expected public.order_status, p_status public.order_status, p_note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_old public.order_status; v_event uuid; v_missing boolean; v_eligible boolean;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception 'note_too_long' using errcode = '22023'; end if;
  if not public.consume_admin_rate_limit('order_transition', 30, 60) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  select status, stock_restore_eligible into v_old, v_eligible from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if p_expected is null or v_old <> p_expected then raise exception 'order_status_conflict' using errcode = 'P0001'; end if;
  if not (
    (v_old = 'pending' and p_status in ('confirmed', 'cancelled')) or
    (v_old = 'confirmed' and p_status in ('processing', 'cancelled')) or
    (v_old = 'processing' and p_status in ('shipped', 'cancelled')) or
    (v_old = 'shipped' and p_status = 'completed')
  ) then raise exception 'invalid_order_transition' using errcode = '22023'; end if;
  if p_status = 'cancelled' then
    if not v_eligible then raise exception 'legacy_stock_requires_review' using errcode = 'P0001'; end if;
    if exists (select 1 from public.order_status_history where order_id = p_order_id and new_status = 'cancelled') then
      raise exception 'legacy_cancellation_requires_review' using errcode = 'P0001';
    end if;
    perform i.id from public.order_items i where i.order_id = p_order_id order by i.id for update;
    perform p.id from public.products p
      where p.id in (select i.product_id from public.order_items i where i.order_id = p_order_id)
      order by p.id for update;
    select exists (
      select 1 from public.order_items i left join public.products p on p.id = i.product_id
      where i.order_id = p_order_id and p.id is null
    ) into v_missing;
    if v_missing or not exists (select 1 from public.order_items where order_id = p_order_id) then
      raise exception 'missing_order_products' using errcode = 'P0001';
    end if;
    perform pg_catalog.set_config('app.inventory_reason', 'Order cancellation ' || p_order_id::text, true);
    update public.products p set stock_quantity = p.stock_quantity + i.quantity
      from (select product_id, sum(quantity)::integer as quantity from public.order_items
            where order_id = p_order_id group by product_id) i
      where p.id = i.product_id;
  end if;
  perform pg_catalog.set_config('app.order_status_note', coalesce(p_note, ''), true);
  update public.orders set status = p_status where id = p_order_id;
  select id into v_event from public.order_status_history
    where order_id = p_order_id and previous_status = v_old and new_status = p_status
    order by created_at desc, id desc limit 1;
  if v_event is null then raise exception 'order_history_missing' using errcode = 'P0001'; end if;
  return v_event;
end;
$$;
revoke all on function public.admin_transition_order(uuid, public.order_status, public.order_status, text) from public, anon, authenticated;
grant execute on function public.admin_transition_order(uuid, public.order_status, public.order_status, text) to authenticated;

create or replace function public.admin_save_order_details(
  p_order_id uuid, p_internal_note text, p_shipping_provider text, p_tracking_number text
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if length(p_internal_note) > 5000 or length(p_shipping_provider) > 120 or length(p_tracking_number) > 200 then
    raise exception 'invalid_order_details' using errcode = '22023';
  end if;
  if not public.consume_admin_rate_limit('order_details', 30, 60) then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  perform id from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  insert into public.order_admin_details(order_id, internal_note, shipping_provider, tracking_number)
  values (p_order_id, nullif(btrim(p_internal_note), ''), nullif(btrim(p_shipping_provider), ''), nullif(btrim(p_tracking_number), ''))
  on conflict (order_id) do update set internal_note = excluded.internal_note,
    shipping_provider = excluded.shipping_provider, tracking_number = excluded.tracking_number, updated_at = now();
  insert into public.admin_activity_logs(admin_user_id, action, entity_type, entity_id, description)
  values ((select auth.uid()), 'update', 'order_admin_details', p_order_id, 'Order private details updated');
  return true;
end;
$$;
revoke all on function public.admin_save_order_details(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_save_order_details(uuid,text,text,text) to authenticated;

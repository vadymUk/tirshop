-- 0011: database side of the future payment architecture (no provider is integrated).
--
--  * orders.payment_status is the single "is it paid?" flag and is independent of any provider.
--  * payments (0006) stores provider attempts; payment_events stores every verified provider
--    notification once (idempotency + audit).
--  * apply_payment_event() is the only way to change payment state. It is executable by the
--    service role only, so a browser (anon/authenticated) can never mark an order as paid.

create table if not exists public.payment_events (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null check (char_length(provider) between 2 and 50),
  event_id             text not null check (char_length(event_id) between 1 and 255),
  provider_payment_id  text not null,
  status               public.payment_status not null,
  outcome              text not null check (outcome in ('applied', 'ignored')),
  payload              jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
-- No policies: not readable or writable by browser roles; the service role bypasses RLS.

-- Allowed transitions of orders.payment_status:
--   pending -> paid | failed,  failed -> paid (retry),  paid -> refunded.
create or replace function public.apply_payment_event(
  p_provider            text,
  p_event_id            text,
  p_provider_payment_id text,
  p_status              public.payment_status,
  p_amount              numeric,
  p_currency            text,
  p_payload             jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order   public.orders%rowtype;
  v_allowed boolean;
begin
  -- Idempotency: a provider retries webhooks; process each event once.
  insert into public.payment_events (provider, event_id, provider_payment_id, status, outcome, payload)
  values (p_provider, p_event_id, p_provider_payment_id, p_status, 'ignored', coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  select * into v_payment
  from public.payments
  where provider = p_provider and provider_payment_id = p_provider_payment_id
  for update;
  if not found then
    return 'ignored';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found then
    return 'ignored';
  end if;

  v_allowed := case
    when v_order.payment_status = 'pending'  and p_status in ('paid', 'failed') then true
    when v_order.payment_status = 'failed'   and p_status = 'paid' then true
    when v_order.payment_status = 'paid'     and p_status = 'refunded' then true
    else false
  end;

  if p_status = 'paid'
     and (p_amount is distinct from v_order.total_amount or p_currency is distinct from v_order.currency) then
    -- The whole transaction (including the event row) rolls back; the caller must not ack as paid.
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;

  if not v_allowed then
    return 'ignored';
  end if;

  update public.payments set status = p_status where id = v_payment.id;
  update public.orders set payment_status = p_status where id = v_order.id;
  update public.payment_events
    set outcome = 'applied'
    where provider = p_provider and event_id = p_event_id;

  return 'applied';
end;
$$;

revoke all on function public.apply_payment_event(text, text, text, public.payment_status, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, public.payment_status, numeric, text, jsonb)
  to service_role;

-- Public business details are optional; notification preferences remain private.
alter table public.site_settings
  add column company_name text,
  add column nip text,
  add column regon text,
  add column vat_details text,
  add column return_address text,
  add column seller_notification_email text,
  add column customer_email_notifications boolean not null default true,
  add column order_status_notifications boolean not null default true,
  add constraint site_settings_company_name_length check (char_length(company_name) <= 200),
  add constraint site_settings_nip_length check (char_length(nip) <= 100),
  add constraint site_settings_regon_length check (char_length(regon) <= 100),
  add constraint site_settings_vat_details_length check (char_length(vat_details) <= 500),
  add constraint site_settings_return_address_length check (char_length(return_address) <= 500),
  add constraint site_settings_seller_email_length check (char_length(seller_notification_email) <= 254);

grant select (company_name, nip, regon, vat_details, return_address)
  on public.site_settings to anon, authenticated;

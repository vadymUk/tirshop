# Deployment and launch checklist

## 1. Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Final https URL, no trailing slash. Used for canonical URLs, sitemap, auth redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable (anon) key only |
| `NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS` | public | `true` only on Supabase plans with Image Transformations, else `false` |
| `SUPABASE_SECRET_KEY` | **server** | service-role/secret key. Never prefix with `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | **server** | Resend API key |
| `RESEND_FROM_EMAIL` | **server** | `Truck Shop <orders@your-domain>` on a verified domain |
| `SELLER_EMAIL` | **server** | Receives new-order notifications |

Set them in Vercel for **Production** (and Preview, ideally pointing at a staging Supabase project).

## 2. Supabase

1. Create the project. Apply `supabase/migrations/0001` … `0021` in order, then `supabase/seed.sql` (demo data; replace with real catalog). Apply each migration only once.
2. To use Supabase SQL Editor, open each migration file in order, paste its full contents, and run it. Do not run `0012_admin_dashboard.sql` against a project that has not already applied `0001`–`0011`.
3. After creating the intended administrator account through the existing email/password Supabase Auth flow, use a trusted SQL Editor session to promote its existing profile by UUID: `UPDATE public.profiles SET role = 'admin' WHERE id = '<auth.users UUID>';`. Confirm the UUID belongs to the intended account first. Never accept role values from user metadata or expose this update through ordinary client access.
4. Auth → URL Configuration: Site URL = production URL; Redirect URLs: `https://<domain>/auth/callback`, `https://<domain>/auth/reset-password`.
5. Auth → Providers → Email: enable "Confirm email"; set a minimum password length (8+); enable leaked-password protection if available.
6. Auth → SMTP: configure custom SMTP (Resend SMTP works) so confirmation/reset emails are deliverable.
7. Storage: `product-images` and `site-media` are public-read, with no client write policies. Use the validated admin media UI; never expose the secret key.
8. Verify RLS is on for every table (migrations do this) and run `npm run test:db` against a **separate** test project.
9. Rotate the secret key if it was ever shared or committed.

Migration `0012_admin_dashboard.sql` is additive and documented as forward-only. For rollback, disable the admin UI and revoke the relevant access; do not drop its tables or columns unless a destructive rollback is explicitly approved after backup and audit-history retention review.

Apply `0013_admin_dashboard_analytics.sql` after `0012`, using a separate test
project first. The dashboard requires this migration. To disable its analytics RPC
without deleting data, revoke execution with
`REVOKE EXECUTE ON FUNCTION public.admin_dashboard_overview(text, date, date) FROM authenticated;`
after disabling the dashboard. The indexes can remain in place.

Apply `0014_product_management.sql` after `0013` for product editing and bulk
operations. It revokes direct authenticated product deletion and uses an RPC that
blocks deletion of products referenced by orders or images. Disable the product UI
and revoke execution on `public.admin_save_product(uuid,jsonb,integer,integer)`
and `public.admin_bulk_products(uuid[],text)` for a data-preserving access rollback;
do not grant direct deletion back without reviewing the historical-order and
storage-orphan protections.

Apply `0015_category_management.sql` after `0014` for category operations. It
revokes direct authenticated category deletion and provides administrator-only
RPCs for reordering and atomic reassignment/deletion. Categories with image
references cannot yet be deleted. For a data-preserving access rollback, disable
the category UI and revoke execution on `public.admin_delete_category(uuid,uuid)`
and `public.admin_move_category(uuid,uuid)`; do not restore direct deletion without
reviewing product reassignment and image cleanup.

Apply `0016_order_management.sql` after `0015`, first in a separate test project.
It revokes the previous unrestricted status RPC, adds admin-only private order
details and an atomic transition RPC. New orders reserve stock at checkout;
cancellation before shipping restores it once. Orders predating this migration
are blocked from cancellation until stock history has been checked: earlier
administrative status changes may not have been recorded. For an individual
non-cancelled order, only after confirming that its original stock deduction has
not already been restored, a trusted SQL operator may run
`UPDATE public.orders SET stock_restore_eligible = true WHERE id = '<order UUID>';`.
Review historical cancellations separately; the migration makes no retroactive
stock changes. Missing product references or a recorded previous cancellation
block automatic restoration even after this reconciliation. Cancellation does not
refund a payment. Payment events must still be verified server-side by the provider.

Email notification is opt-in and attempted after the transition commits; there is
no durable delivery queue or automatic retry. Check provider logs for uncertain
delivery. Do not treat printable order documents as tax invoices. To roll back
access, disable the order UI and revoke execution on
`public.admin_transition_order(uuid,public.order_status,public.order_status,text)`
and `public.admin_save_order_details(uuid,text,text,text)`. Keep the old unrestricted
status RPC revoked and retain the history, inventory and private order data.

Apply `0017_customer_management.sql` after `0016`, first in a separate test
project. It adds a read-only customer summary RPC and indexes. Customer email
and Auth status require the server-only secret key and Auth Admin API; never
expose the key to the browser. To roll back access, disable the customer UI and
revoke execution on
`public.admin_customers(text,date,date,integer,integer,boolean,integer,uuid)`
from `authenticated`. Preserve historical orders and account records.

Apply `0018_media_library.sql` after `0017`, and test first on a separate project.
It creates the public `site-media` bucket, a metadata registry, deletion
tombstones and reference guards. Authenticated administrators do not receive
direct Storage write policies: validated server-side operations use the secret
key after checking the active admin role. This prevents browser uploads from
bypassing image validation and deletion checks. Do not add a direct Storage
write policy or delete files through the dashboard without checking references.

The orphan filter checks known database tables but cannot detect links in
external systems or all possible embedded encodings. Review external use before
confirming deletion. Public images and previews may remain in CDN, browser or
Next.js caches after deletion; deletion is not an immediate purge. Legacy/unregistered objects cannot be deleted through the
UI and have no recorded dimensions. If a Storage deletion fails, retry it in
the UI; its tombstone prevents new references. Keep tombstones, guards and
metadata during rollback; disable the UI and revoke the three
`admin_media_list`, `admin_claim_media_deletion` and
`admin_attach_product_image` RPC grants from `authenticated`. Do not remove
guards or tombstones until all interrupted deletions and references have been
independently reconciled. Use a Node.js server capable of Next.js image
optimization when Supabase transformations are disabled.

Apply `0019_homepage_cms.sql` after `0018`, first on a separate test project.
It seeds the default hero if missing, creates a private draft, restricts direct
authenticated writes to published sections/banners, and adds a service-role-only
atomic publishing RPC. The server verifies the active admin and the document,
and the RPC rechecks the actor and exact draft revision before publishing and
auditing. Preview is available only to admins and is not publicly cached.
Keep the draft, audit records, and media reference guard on rollback; disable the
homepage editor and publishing RPC before rolling application code back. Do not
regrant direct writes without reviewing validation, auditing and cache behavior.
Review existing legacy CMS content and reconcile unsupported settings, positions,
URLs and image bucket paths before rollout; see README for editor limits.

Apply `0020_pages_cms.sql` after `0019` on a separate test project first.
It preserves legacy plain-text pages, adds private drafts and restricts writes
to published pages to the server-validated, service-role-only publishing RPC.
Verify draft privacy, publication and scheduled visibility with the database
tests before production. Create and review the six informational pages in the
admin UI; no legal content or company information is generated by the migration.
Do not expose the service-role key. On rollback, disable page editing and the
publishing RPC first; retain drafts, published content and media reference guards
until the data and access policies have been reviewed.

Apply `0021_store_settings.sql` after `0020` before deploying this application.
Test the new public legal fields and private notification columns on a dedicated
project; do not expose notification settings or server email credentials to
anonymous clients. Review the optional business details before publishing them.
Maintenance, store availability and delivery charge configuration are not yet
connected; do not rely on the current settings UI to control those behaviors.

Apply `0022_ecommerce_analytics.sql` after `0021`. Test the admin-only RPC,
currency separation, date boundaries and paid/cancelled/refunded calculations
on a dedicated Supabase project before deployment. `/admin/analytics` requires
this migration; its report limitations and metric definitions are in README.
To disable access, revoke execution of `admin_ecommerce_analytics(text, date,
date, text, text, integer)` from `authenticated` and disable the analytics UI.

Apply `0023_inventory_management.sql` after `0022` on a dedicated test project
first. Run inventory, checkout and order transition database tests and verify
the existing stock trigger and column-level grants before deploying. It adds
admin-only inventory RPCs and changes the trigger's default reason; it does not
change checkout or cancellation stock calculations. To disable the new module,
revoke execution of `admin_adjust_inventory(uuid[], integer[], text, integer,
text)` and `admin_inventory_list(text, text, integer, integer)` from
`authenticated` and disable the inventory UI. Preserve the stock trigger and
inventory logs on rollback.

Apply `0024_admin_activity.sql` after `0023` before deploying the matching app.
It revokes authenticated access to the old free-form logging RPC and provides
restricted server-only RPCs; the server must have `SUPABASE_SECRET_KEY`.
Password-based sign-in fails if the new audit RPC is unavailable. Test login,
RLS, immutable records, metadata, and direct RPC access on an isolated project
before rollout. Review legacy logs for sensitive data. Disable the audit UI and
password login auditing together when rolling back application code; retain
audit history, and do not restore the unrestricted logging grant.

Apply `0025_admin_notifications.sql` after `0024` on an isolated project first.
Run the notification database tests and verify active-admin authorization,
per-user read state, preferences, deduplication, service-role-only email failure
recording, and checkout/cancellation behavior before deployment. This migration
has not been tested on a real database in this environment. Polling imports
historical events in bounded batches and repeatedly scans source records;
monitor database load and backlog size. The current stock threshold is used for
historical inventory events, and initial zero-stock states that disappear before
polling cannot be recovered. The only security event currently detected is a
successful password-based administrator login. Email failure alerts are
best-effort and can be lost when the notification database or server is down.
If rolling back, disable the notification UI and email-failure reporting
together; preserve the notification tables and read history.

Apply `0026_product_cost_privacy.sql` after `0025` and deploy the matching app.
The prior table-wide product SELECT grant exposes `cost_price` to anonymous
clients for active products. This migration restricts product columns and
provides an active-admin-checked cost RPC; the updated editor uses an explicit
safe projection. Existing external clients using `SELECT *` on products must
switch to explicit allowed columns. Applying the migration before updating an
older editor can temporarily break that editor. Never restore the broad SELECT
grant as a rollback. Treat previously visible costs as potentially disclosed,
and verify actual production grants, inherited roles, custom views and RPCs.
This migration and its RLS tests have not been run on a real database here;
test catalog, admin access, embedded queries and checkout on an isolated
Supabase project before deployment.

If an earlier version of `0012` was applied or a SQL Editor run failed with
`cannot change return type of existing function`, back up the database and run the
entire current `0012_admin_dashboard.sql` in one SQL Editor execution, without
selecting a fragment. It replaces only the known legacy `void` admin RPCs with
their `boolean` versions and restores their grants; table data is not deleted.
The RPC result is now `false` when rate-limited, so update any existing callers
that assumed a `void` result. If PostgreSQL reports dependencies on a function,
stop and review them rather than using `DROP ... CASCADE`. Verify the migration
and RLS tests on a separate test project before applying it to production.

For a data-preserving access rollback, run the following in Supabase SQL Editor after disabling the admin UI. It removes dashboard-specific access and policies but keeps all migration data and storefront catalog policies:

```sql
drop policy if exists "Admins manage products" on public.products;
drop policy if exists "Admins manage categories" on public.categories;
drop policy if exists "Admins manage product images" on public.product_images;
drop policy if exists "Admins read all profiles" on public.profiles;
drop policy if exists "Admins read all orders" on public.orders;
drop policy if exists "Admins read all order items" on public.order_items;
drop policy if exists "Admins read all payments" on public.payments;
drop policy if exists "Admins manage site settings" on public.site_settings;
drop policy if exists "Public reads singleton site settings" on public.site_settings;
drop policy if exists "Admins manage pages" on public.pages;
drop policy if exists "Public reads published pages" on public.pages;
drop policy if exists "Admins manage homepage sections" on public.homepage_sections;
drop policy if exists "Public reads visible homepage sections" on public.homepage_sections;
drop policy if exists "Admins manage banners" on public.banners;
drop policy if exists "Public reads active banners" on public.banners;
drop policy if exists "Admins read activity logs" on public.admin_activity_logs;
drop policy if exists "Admins read inventory logs" on public.inventory_logs;
drop policy if exists "Admins read order status history" on public.order_status_history;

revoke insert, update, delete on public.products, public.categories, public.product_images
  from authenticated;
revoke insert (category_id, name, slug, short_description, description, price,
  currency, is_active, sku, compare_at_price, cost_price, is_featured, meta_title,
  meta_description, og_image_path, weight),
  update (category_id, name, slug, short_description, description, price,
  currency, is_active, sku, compare_at_price, cost_price, is_featured, meta_title,
  meta_description, og_image_path, weight)
  on public.products from authenticated;
revoke insert, update on public.site_settings from authenticated;
revoke select, insert, update, delete on public.pages, public.homepage_sections, public.banners
  from anon, authenticated;
revoke select (id, store_name, store_description, logo_path, favicon_path, contact_email,
  contact_phone, whatsapp_number, viber_number, telegram_username, business_address,
  currency, default_language, timezone, facebook_url, instagram_url, tiktok_url,
  youtube_url, announcement_text, announcement_enabled, created_at, updated_at)
  on public.site_settings from anon, authenticated;
revoke select, insert on public.admin_activity_logs from authenticated;
revoke select on public.inventory_logs, public.order_status_history from authenticated;

revoke execute on function public.admin_set_product_stock(uuid, integer, text) from authenticated;
revoke execute on function public.admin_update_order_status(uuid, public.order_status, text)
  from authenticated;
revoke execute on function public.record_admin_activity(text, text, uuid, text, jsonb, inet)
  from authenticated;
revoke execute on function public.consume_admin_rate_limit(text, integer, integer)
  from authenticated;
revoke execute on function public.get_admin_site_settings() from authenticated;
revoke execute on function public.is_active_admin() from authenticated;
```

## 3. Resend

1. Add and verify your sending domain (SPF, DKIM, and DMARC DNS records).
2. Create an API key with "Sending access" only.
3. Use an address on that domain in `RESEND_FROM_EMAIL`. Without a verified domain Resend only delivers to your own account.

## 4. Vercel

1. Import the repository. Framework preset: Next.js. Node.js version: 22.x (Project Settings → General).
2. Add the environment variables above.
3. Deploy. Add your domain, and make sure `NEXT_PUBLIC_SITE_URL` matches it exactly (redeploy after changing).
4. Region: pick the one closest to your Supabase region.

## 5. Owner tasks before going live

- Replace every highlighted `[[…]]` placeholder in the legal pages (`lib/legal-content.ts`) and have a lawyer review them. Remove `robots: { index: false }` from the legal pages once final.
- Fill in the company details on `/about#company`.
- Replace the demo catalog and images.
- Payments are **not** integrated: orders are created with `payment_status = pending` (see `lib/payments`).
- The rate limiter (`lib/rate-limit.ts`) is in-memory per serverless instance. For stricter abuse protection add a shared store (e.g. Upstash Redis) or Vercel WAF rules. Database-level order limits (10/hour/user) already apply.
- Optional: connect an error tracker (Sentry) — errors are currently logged with `console.error` only.

## 6. Post-deployment checklist

- [ ] `/`, `/products`, a product page, a category page load; images load from Supabase via `/_next/image`
- [ ] `/robots.txt` and `/sitemap.xml` use the production domain
- [ ] Register → confirmation email arrives → link lands on the site signed in
- [ ] Login, logout (account menu → "Вийти"), session persists after reload
- [ ] Password reset email → `/auth/reset-password` works
- [ ] Guests are redirected from `/cart`, `/checkout`, `/favorites`, `/account`
- [ ] Add/remove favorites; add to cart, change quantity, stock limit enforced
- [ ] Checkout: consent checkbox required; order created; cart emptied; stock decremented
- [ ] Seller email and customer confirmation email arrive (check spam, SPF/DKIM pass)
- [ ] Another account cannot open the first account's `/account/orders/<id>`
- [ ] A guest receives HTTP 401 on `/admin`, a customer or inactive admin receives HTTP 403, and an active admin can sign in with email/password
- [ ] Language and theme switch persist after reload; header fits at 360 px
- [ ] `/privacy`, `/terms`, `/shipping`, `/returns` reachable from the footer
- [ ] Response headers contain CSP, HSTS, `X-Frame-Options`; no secrets in the page source or JS bundles
- [ ] Unknown URL shows the custom 404
- [ ] Lighthouse mobile on `/` and a product page: LCP < 2.5 s, CLS < 0.1
- [ ] Run `npm run test:e2e` against the disposable local environment described in README; never run destructive tests against production.

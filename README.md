# Truck Shop

Ecommerce for truck drivers. Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth, Storage) · Resend + React Email.

## Start

```powershell
npm install
Copy-Item .env.example .env.local   # PowerShell; fill in Supabase + Resend values
# Apply migrations 0001 through 0027 in order in a new Supabase project, then run supabase/seed.sql.
# Do not re-run applied migrations; review 0001 before using a project with existing catalog data.
npm run dev
```

Requires Node.js 22.13 or later. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`.

## Testing

Unit and mocked integration tests do not connect to Supabase:

```powershell
npm run test
npm run test:unit
npm run test:integration
```

Database and browser tests can create, modify and delete data, including users,
orders and inventory. Use only a **disposable local** Supabase stack at
`http://127.0.0.1:54321`; remote projects, alternate endpoints, and attaching
Playwright to an existing application server are rejected. Do not tunnel that
local address to a remote database. The checks cannot detect a local proxy that
forwards traffic elsewhere. The local stack must not contain data to preserve.

Install the Supabase CLI and Docker, initialize its local configuration if needed,
and start Supabase from this repository with migrations `0001`–`0026` and the local
seed applied. Copy `.env.test.example` to `.env.test` and fill in the local
publishable and service-role keys shown by `supabase status`. Keep this file
private and set `ALLOW_DB_TESTS=true`. Then run:

```powershell
npm run test:db
```

Without `ALLOW_DB_TESTS=true`, DB tests are skipped; with the flag set, missing
or non-local configuration is an error. The DB suite changes shared local data,
and interrupted runs can leave fixtures, logs and other side effects. Dispose of
the entire test stack when finished; cleanup is not a substitute for isolation.

For browser tests, copy `.env.e2e.example` to `.env.e2e`, supply the same local
keys, and leave `E2E_ISOLATED=true`. The application port must be free; Playwright
starts a new development server with those local keys and disables Resend email.
Install Chromium with `npx playwright install chromium` if necessary:

```powershell
npm run test:e2e
npm run test:e2e -- --project=admin
npm run test:e2e:public
```

The admin E2E suite creates temporary local users and exercises access, product,
category and order workflows, customer history and five viewport widths. The older authenticated
storefront suite additionally needs a dedicated local customer account in
`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`; the optional `E2E_PLACE_ORDER=true` test
creates a local order. Email delivery itself is not E2E-tested because Resend is
disabled. `npm run test:all` requires both local environment files. Inspect test
results: skipped DB or authenticated tests are not successful live verification.

The current application returns HTTP 401 for unauthenticated admin access rather
than redirecting to login. Owner, manager and editor roles and their permissions
are not implemented; role-specific E2E tests cannot pass until that functionality
exists. Admin image and CMS flows, email delivery and additional order/customer cases
have mocked integration and/or local DB coverage but do not yet have complete
browser E2E coverage.

## Structure

- `app/` routes (Server Components by default), `proxy.ts` refreshes Supabase sessions
- `lib/supabase/` `client.ts` (browser), `server.ts` (server), `admin.ts` (secret key, server-only), `proxy.ts`
- `lib/db/queries/` reusable server-side queries
- `lib/validations/` shared Zod schemas
- `lib/email/`, `emails/` Resend client and React Email templates
- `components/ui` shadcn-style primitives, `components/layout`, `components/shared`
- `supabase/migrations/` SQL schema and RLS

## Admin database setup

Apply `supabase/migrations/0012_admin_dashboard.sql` once, after migrations `0001`–`0011`, using the Supabase SQL Editor. It extends the existing commerce tables and creates admin/content/history tables; it does not migrate existing static page content or remove records. See `DEPLOYMENT.md` for the application and first-admin setup steps.

Apply `supabase/migrations/0013_admin_dashboard_analytics.sql` after `0012`. The
dashboard uses its administrator-only aggregation RPC; apply it to a separate test
project and run `npm run test:db` before deploying it to production.

Apply `supabase/migrations/0014_product_management.sql` after `0013` to enable the
product forms and bulk operations. Product saves reject stale stock values. Deletion
is blocked if any order item or image refers to a product, and is transactional for
the entire selection. Deactivate products with order history instead. Detach
product images before deleting an otherwise eligible product.

Apply `supabase/migrations/0015_category_management.sql` after `0014` for category
management. Categories with products can only be deleted by reassigning the products
to another category; the operation is atomic. Deletion is blocked when a category
has an image reference, because category image upload and storage cleanup are not
yet implemented. Test on a separate Supabase project before production deployment.

Apply `supabase/migrations/0016_order_management.sql` after `0015`. Order status
transitions are pending → confirmed → processing → shipped → completed, with
cancellation allowed before shipping. Checkout deducts stock; cancellation restores
it once, transactionally. Pre-migration orders require manual stock reconciliation
before cancellation; see `DEPLOYMENT.md`. Cancellation does not initiate a payment
refund. Payment status is not editable in the admin UI.

Apply `supabase/migrations/0017_customer_management.sql` after `0016`. Customer
search covers profile name and phone. Registration filters and sorting use the
profile creation timestamp in UTC; the displayed registration date comes from
Supabase Auth. Profiles are normally created at registration, but legacy profile
timestamps may differ. The list includes customer-role profiles, not staff.
Order counts and totals include all orders, including cancelled and unpaid orders;
totals are separated by currency, without conversion. Addresses and contact
details are the snapshots saved with each order. Only orders linked by user ID
are included, not guest orders or orders whose account was deleted.

The customer module is read-only: it does not change, suspend, or delete accounts.
Email and authentication status are fetched with the server-only Auth Admin API
after verifying administrator access; passwords and tokens are never displayed.
Restrict administrative access and handle customer data according to applicable
retention and privacy policies.

Apply `supabase/migrations/0018_media_library.sql` after `0017`. The media library
lists the existing `product-images` bucket and the new public `site-media` bucket.
Files are public: do not upload private or sensitive material. Uploads accept
JPG/JPEG, PNG and WebP (8 MiB input, 50 million pixels); the server verifies and
re-encodes them as non-animated WebP, strips metadata and limits the longest side
to 2000 pixels. SVG is not accepted. The type filter describes the stored file,
so new uploads appear as WebP. Thumbnails use Supabase transformations when
enabled, otherwise Next.js image optimization.

Choose an existing image from the media library on the product edit page; a new
copy is linked under that product's folder. Detaching an image keeps the file.
The orphan filter means “no known database references”, not proof that a public
URL is unused outside the database. Deletion requires confirmation and rechecks
products, product images, categories, pages, banners, homepage sections and
site settings. It blocks new database references while deletion is pending and
afterward. Files uploaded before this library have unknown dimensions unless
registered, and cannot be deleted here: inspect their references and external
usage manually. Failed uploads can also leave files requiring manual review.

Apply `supabase/migrations/0019_homepage_cms.sql` after `0018`. The homepage
editor at `/admin/homepage` saves a private shared draft. Save before opening
preview; publishing validates and atomically replaces the published banner set
and updates the sections. Conflicting draft edits require a page refresh.
Publication is recorded in the admin activity log. Text is plain text, links
must be internal paths or HTTPS, and image fields are paths in `site-media`;
copy paths from the media library. Image references in drafts are protected
against media cleanup. Only active products and categories appear publicly.
Section order is determined by the order field; banners use position and order.
Banner start is inclusive and end is exclusive, in UTC.

The migration adds the existing default hero only when no hero exists. Review
any pre-existing CMS records before deployment: unsupported legacy settings,
banner positions other than `hero`, `top`, `middle` and `bottom`, unsafe URLs,
or image paths outside `site-media` must be reconciled before using the editor.
The editor supports up to 50 sections, 100 banners, and 1,000 product or category
choices; each section can select up to 24 products or categories. Saving changes
is explicit; editing forms do not auto-save. Public sections are cached for up
to 60 seconds and invalidated on publish; scheduled banners are read without a
cross-request cache so their schedule takes effect on request. Visible featured
product sections show manually selected active products first, then all other
active products marked “Рекомендований”; disabled sections remain hidden.
Featured products are read on request, including in the draft preview.

Public product and category queries use separate cache tags. Admin product,
image and inventory mutations expire product data; category mutations expire
both categories and products because cards embed category data. Successful
checkout expires product stock data immediately, without caching cart, order
or account data. Public settings use request-local memoization, and changes to
public settings refresh the shared layout; notification and stock-threshold
settings do not invalidate it. Admin, cart, checkout, favorites, account and
authentication responses are marked private and no-store. External database
changes that bypass application actions do not trigger immediate revalidation;
cached product/category data becomes eligible for revalidation after 60/120
seconds.
The existing streaming loading boundaries can cause a missing or inactive
product detail to return HTTP 200 with a not-found page and `noindex` rather
than HTTP 404. Removing that limitation requires changing streaming or adding
an existence check before rendering.

Apply `supabase/migrations/0020_pages_cms.sql` after `0019`. Active admins can
create pages at `/admin/pages`, save private drafts and preview them before
publishing. The six root routes `/about`, `/contact`, `/shipping`, `/returns`,
`/privacy`, and `/terms` use those exact slugs; other slugs use `/pages/<slug>`.
Create and publish the content for these routes explicitly: no company details
or legal text are seeded. Until a published page is available, `/about` retains
its existing content and the four legal routes show their existing unindexed
placeholder drafts; unpublishing restores these fallbacks. The existing contact
and company sections remain on `/about` when its CMS content is published.
Existing plain-text pages remain readable and are
converted to structured content when edited. Review legal text and heading
structure before publishing. The publication date is UTC; future dates become
public on request after that time. Public pages are not cached across requests,
and publication, unpublication, deletion and slug changes revalidate their paths.
Only site-media images and internal or HTTPS links are allowed in rich content.
The renderer accepts validated structured nodes, never raw HTML. Draft revisions
prevent publishing another administrator's concurrent changes; refresh on conflict.
Images are public and remain in the media library after a page is deleted.

Apply `supabase/migrations/0021_store_settings.sql` after `0020` before deploying
the current application. `/admin/settings` edits general, contact, social,
appearance, low-stock, notification and optional business fields. Public
branding, contacts, announcement, language and business details are read from
`site_settings`; missing legal details are not generated. Previously unset
contact numbers retain the existing configured defaults until explicitly saved.
Logo and favicon uploads use the public `site-media` bucket. Notification email
and notification switches are not granted to anonymous users; an empty seller
notification email falls back to the server's `SELLER_EMAIL`. Customer order
confirmation and optional admin-triggered status emails respect their switches.
The settings update uses the existing database audit trigger and rejects stale
edits. The maintenance and store-availability controls and shipping settings
are not yet implemented; no delivery charges are applied by these settings.
Test the migration and access policies on a dedicated Supabase project.

Apply `supabase/migrations/0022_ecommerce_analytics.sql` after `0021` for
`/admin/analytics`. The authenticated RPC independently verifies an active
administrator; the CSV endpoint also checks access and disables caching. Lists
are paginated in groups of 20; CSV streams all report pages. Aggregated data
is fetched in bounded pages rather than loading database records into the
browser. Export pages are separate database requests, not a single snapshot, so
concurrent edits can affect a long-running export.

Analytics calculations:

- All dates use UTC calendar days, with inclusive endpoints. Today, the last
  7/30/90 days and this year include today. Custom ranges are limited to 731
  days. Week buckets start Monday; first and last buckets can be partial.
- Reports select one ISO currency (the store currency by default). No exchange
  rates or cross-currency totals are inferred. Order-based metrics use the
  order creation date and current order/payment status, not the payment date;
  changes and refunds can therefore change historical reports.
- Order count includes cancelled orders. Completed/cancelled counts use the
  current order status. Gross is the sum of non-cancelled order totals regardless
  of payment, including refunded orders. Paid revenue sums only non-cancelled
  orders whose current payment status is `paid`. Unpaid value sums pending and
  failed payments on non-cancelled orders; refunded orders are not unpaid.
  Average order value is gross divided by the number of non-cancelled orders.
- Product and category quantities and revenue use items from paid,
  non-cancelled orders. Best-selling and highest-revenue lists are ranked
  separately. Least-selling includes active products in the selected currency,
  including zero sales. Category order counts are distinct paid orders
  containing an item in the category. Items do not snapshot category: reporting
  uses the product's current category; deleted products have an unknown
  category. Deleted products can still appear in sales using their saved names.
- Total customers are current customer-role profiles; new customers are such
  profiles created in the period, independent of currency. Repeat customers
  have at least two non-cancelled orders in the selected currency and period,
  regardless of payment status. Top customers are ranked by non-cancelled
  order value, including unpaid and refunded orders, in the selected currency and period; deleted
  accounts and non-customer profiles are excluded.
- Low-stock and out-of-stock lists use current active products in the selected
  currency. Low stock is positive stock at or below the configured threshold;
  zero stock is reported separately. These lists are current, not historical.

Apply `supabase/migrations/0023_inventory_management.sql` after `0022` for
`/admin/inventory`. Active admins can search all products by name or SKU,
filter by stock, inspect paginated movement history, adjust stock and export
the filtered list. The common low-stock threshold comes from store settings:
zero is out of stock, positive quantities at or below the threshold are low,
and quantities above it are sufficient. The in-stock filter includes all
positive quantities, including low stock. Inactive products are included in the
inventory list; the dashboard alert counts only active products, including
zero-stock items. Last stock update comes from the newest inventory log, not
the product modification timestamp.

An adjustment sets, increases or decreases each selected product by the same
whole quantity and requires a reason. The RPC validates the active admin and
locks products in ID order, compares the displayed stock to current stock,
and either updates all selected products or none. The existing inventory
trigger records the actor, before/after, change, reason and time in the same
transaction. Existing product editing records its generic `Admin product edit`
reason. Checkout and cancellation retain their existing stock operations;
checkout/system changes without a specific reason use `Checkout or trusted
stock operation`. Historical records may have no reason or administrator,
and zero-stock initial products have no movement record. Historical inventory
is not reconstructed before the original baseline. The CSV export is streamed
in pages; concurrent catalog changes can affect a long-running export because
its pages are separate requests, not one snapshot.

Run inventory and checkout DB tests against a dedicated Supabase test project
before deployment, including access, stock adjustment, checkout concurrency
and cancellation restoration tests. Migration `0023` has not been verified on
a real database in this environment.

Apply `supabase/migrations/0024_admin_activity.sql` after `0023` before deploying
this application. `/admin/activity` shows the admin ID, action, entity, UTC
date, description and allowlisted metadata; it supports filters, search,
pagination and CSV export. Existing active admins can access the log; granular
owner/manager/editor permissions are not yet implemented. Normal authenticated
clients cannot update, delete or manually append audit records. Database
triggers record admin catalog, category, stock, order status and settings
changes in the same transaction. Product price/stock and order status changes
include before/after values without copying personal data or settings.
Page publication already writes its audit record in the publication transaction.

The server-only `auditLog()` helper records supported media events through a
service-role-only RPC that rechecks the actor and permits only bounded counts
and known bucket names. It does not accept arbitrary descriptions, file paths,
passwords, tokens or payment details. Media storage operations and their audit
record are separate transactions: failures are reported but an already
completed storage operation cannot be rolled back automatically.
Password-based sign-in records successful administrator logins; email links and
other Auth flows are not currently logged. Password sign-in now requires the
server secret and the `0024` RPC to be available: if auditing fails, the app
reports failure and attempts to close the new session. Never expose the secret
to the browser. Account administration, manual payment status changes,
administrator invitations and role management are not implemented and thus
have no corresponding audit events yet.

The viewer and export whitelist metadata; pre-existing descriptions and older
database records are not automatically sanitized or deleted and should be
reviewed under the store's retention policy. CSV pages are separate requests,
so concurrent new events can affect an export. Test migration, log
immutability, access and login failure behavior on a dedicated Supabase project
before deployment; these DB tests were not run in this environment.

Administrators may opt to send a status email to the saved order email. A Resend
idempotency key is tied to the status history event. Delivery is attempted after
commit, without a persistent queue or automatic retry: a failed request is shown
to the administrator, while a server interruption can prevent the attempt. Check
Resend before manually contacting the customer. Print views support saving an
order document or packing slip to PDF through the browser; neither is a tax invoice.

Apply `supabase/migrations/0025_admin_notifications.sql` after `0024` before
deploying. The admin header polls while open in the browser, retries after
network reconnection and provides history, per-admin read state and per-admin
event preferences. Active admins can access notifications; granular roles are
not yet implemented. Notification records contain event type, source ID,
entity ID and timestamp, not customer details. Database functions verify
administrator access, and only the server-side service role can record email
failures.

Existing order, inventory and status history records are imported in batches of
up to 250 per source on each poll, with unique event keys to prevent duplicates.
This also imports historical events; counts and “mark all” cover only events
already imported. Importing a large backlog can take time and repeated scans
should be monitored on large databases. No checkout or stock transaction is
changed. Inventory alerts use the current threshold when history is imported,
and only products active at import time are considered. Zero-stock products
without a movement are detected from current stock; an initial zero that is
restocked before any poll cannot be reconstructed. Security notifications
currently cover successful password-based administrator logins only, not
failed logins or role changes.

Resend delivery remains separate from database notifications and has no durable
retry queue. An email failure is recorded best-effort after the order or status
transaction; if the database is unavailable or the server stops, that
notification can be lost and the failure is logged on the server. Email
failures for the same order or status event are deduplicated.
Migration `0025`, RLS, concurrent imports and email-failure recording have not
been verified against a real database in this environment. Test them on a
dedicated Supabase project before deployment.

The migration is forward-only. Its header documents the rollback approach; do not drop the new tables in production because they may contain settings and audit history.

Apply `supabase/migrations/0026_product_cost_privacy.sql` after `0025` and deploy
the matching application together. Earlier table-wide product SELECT grants
allow public access to `cost_price`; the migration replaces them with an
explicit safe column list. Direct `SELECT *` on products and direct selection
of `cost_price` no longer work for anonymous or authenticated clients, including
admins. Active admins can retrieve a product's cost with the
`admin_product_cost` RPC; the product editor does not use or display it.
Previously exposed costs should be considered potentially disclosed. Verify
column grants, nested queries, the RPC and checkout on an isolated Supabase
project before production; the migration and database tests have not been run
in this environment. Review deployed grants and custom views/functions for
additional access paths.

The `/admin` dashboard requires an active administrator and migrations `0012`–`0026`. Its
overview, paginated lists and detail views generally read through the authenticated
Supabase client and RLS. Customer summaries additionally use an admin-checked
RPC and the server-only Auth Admin API. Product creation, editing and bulk status/deletion are available.
Category image management, CSV export and other management forms are not yet
connected; team administration is also not connected. The SEO
view currently covers database-backed pages only. The product list uses its
configurable low-stock threshold; the overview still uses the fixed threshold of 5.

Product SEO titles and descriptions override the generated metadata when present.
The product OG image field is a path in `site-media`; an empty field uses the
first product image. Reconcile any legacy values that are not valid media paths.
The sitemap is generated on request from active catalog entries and currently
published CMS pages; it fails explicitly if data cannot be loaded or exceeds
the single-sitemap limit of 50,000 URLs.

### Dashboard metrics

The date filter uses inclusive UTC calendar dates, based on `orders.created_at`.
Presets include the current UTC day; custom ranges are limited to 731 days. Counts
and charts show current statuses, not historical status at the end of the range.
Product, category and customer cards are current totals, independent of the date
filter; customers are profiles with role `customer`. Out-of-stock counts all
products with quantity zero, while the low-stock list contains active products
with five or fewer units. Recent lists show the latest five records overall.

Order value sums all order totals, including cancelled orders. Paid revenue sums
order totals only when `payment_status = 'paid'` and `status <> 'cancelled'`,
whether or not fulfilment is complete. Pending payment value includes only
non-cancelled orders with payment status `pending`; cancelled value includes all
cancelled orders regardless of payment status. Failed and refunded orders are not
paid revenue or pending payment. All monetary totals and revenue timelines are
separated by order currency without conversion. Revenue is attributed to the
order creation date, not the payment date, and represents current paid status,
not an accounting ledger or net-of-refund cash flow.

Best sellers and categories use quantities and item subtotals from paid,
non-cancelled orders, ranked by quantity separately per currency. Category uses
the product's current category; deleted products or unavailable categories are
grouped as unknown. Existing products are grouped by product ID and currency;
their displayed name is taken from an order snapshot. Deleted products are grouped
by their snapshot name and currency. Orders by status count all statuses. Revenue
charts are separated by currency, and order charts count all orders.

Admin access is verified on the server against `profiles.role` and `profiles.is_active`; Auth metadata is not used for authorization. The `/admin` layout and privileged image operations check authorization independently, and database RLS is the final enforcement layer. Admin and login failures return 401/403; login and image operations use the existing rate limiter.

## Supabase Auth setup

- Authentication -> URL Configuration: Site URL = NEXT_PUBLIC_SITE_URL; add Redirect URL `<site>/auth/callback`.
- Authentication -> Providers -> Email: enable email provider and 'Confirm email'.
- Optional (works across browsers): in the Confirm signup and Reset password email templates use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup` (`type=recovery` for reset, plus `&next=/auth/reset-password`).

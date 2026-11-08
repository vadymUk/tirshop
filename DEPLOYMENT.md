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

1. Create the project. Apply `supabase/migrations/0001` … `0011` in order, then `supabase/seed.sql` (demo data; replace with real catalog).
2. Auth → URL Configuration: Site URL = production URL; Redirect URLs: `https://<domain>/auth/callback`, `https://<domain>/auth/reset-password`.
3. Auth → Providers → Email: enable "Confirm email"; set a minimum password length (8+); enable leaked-password protection if available.
4. Auth → SMTP: configure custom SMTP (Resend SMTP works) so confirmation/reset emails are deliverable.
5. Storage: bucket `product-images` is public-read with no client write policies. Upload product images only via dashboard or the secret key.
6. Verify RLS is on for every table (migrations do this) and run `npm run test:db` against a **separate** test project.
7. Rotate the secret key if it was ever shared or committed.

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
- [ ] Language and theme switch persist after reload; header fits at 360 px
- [ ] `/privacy`, `/terms`, `/shipping`, `/returns` reachable from the footer
- [ ] Response headers contain CSP, HSTS, `X-Frame-Options`; no secrets in the page source or JS bundles
- [ ] Unknown URL shows the custom 404
- [ ] Lighthouse mobile on `/` and a product page: LCP < 2.5 s, CLS < 0.1
- [ ] `npm run test:e2e` against the production URL (`E2E_BASE_URL`) with a dedicated test account

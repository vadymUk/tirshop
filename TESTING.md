# Testing

## Strategy

| Layer | Folder | Runs against | Command |
|---|---|---|---|
| Unit | `tests/unit` | Pure logic (Zod schemas, cart maths, listing params, redirects, rate limiter, stock status) | `npm run test:unit` |
| Integration | `tests/integration` | Server actions, queries, proxy and email code with a **mocked** Supabase/Resend | `npm run test:integration` |
| Database | `tests/db` | A **real, dedicated** Supabase project: RLS, `place_order`, race conditions, payment events | `npm run test:db` |
| End-to-end | `tests/e2e` | A running app in a browser (Playwright) | `npm run test:e2e` |

`npm test` runs unit + integration (fast, offline, no secrets). `npm run test:all` runs everything.

## Coverage map

- **Auth**: validation + actions (unit/integration), protected routes (`proxy-routes`, E2E), login/logout/session (E2E; logout is client-side so it is E2E-only).
- **Products**: listing, pagination, details, categories, search incl. filter-injection safety (integration + E2E).
- **Favorites / Cart**: ownership, quantity and stock limits (integration + DB/RLS + E2E).
- **Checkout**: validation, consent, server-side prices, stock, order creation, cart clearing, unauthorized access (integration, DB, E2E).
- **Security**: cross-user access, RLS, order ownership, price manipulation, storage write denial, forged payments (DB).
- **Race conditions**: last item bought by two users, 8 buyers for 3 items, rollback on partial failure (DB).
- **Email**: seller + customer emails, idempotency keys, HTML escaping, failure isolation (integration).

## Running

```bash
npm test                 # unit + integration
npm run test:watch
```

### Database tests (real Supabase)

1. Create a **separate, disposable** Supabase project and apply migrations `0001`–`0011`.
2. `copy .env.test.example .env.test` and fill in the URL, publishable key and secret key.
3. `npm run test:db`

Without `ALLOW_DB_TESTS=true` and all three keys the suite is skipped. The tests create and delete their own users, products and orders. **Never point them at production.**

### End-to-end tests

```bash
npx playwright install chromium
copy .env.e2e.example .env.e2e     # only for authenticated flows
npm run test:e2e:public            # guest flows, no credentials needed
npm run test:e2e                   # + authenticated flows (needs E2E_USER_EMAIL/PASSWORD)
```

The config starts `npm run dev` (or `npm run start` in CI) automatically, or targets `E2E_BASE_URL`. Set `E2E_PLACE_ORDER=true` to also run the full order flow (creates a real order and sends emails). E2E runs use the Ukrainian UI via the `site-language` cookie.

Full registration (email confirmation) is intentionally not automated end-to-end.

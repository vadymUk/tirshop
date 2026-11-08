# Truck Shop

Ecommerce for truck drivers. Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth, Storage) · Resend + React Email.

## Start

```powershell
npm install
Copy-Item .env.example .env.local   # PowerShell; fill in Supabase + Resend values
# Apply migrations 0001 through 0011 in order in a new Supabase project, then run supabase/seed.sql.
# Do not re-run applied migrations; review 0001 before using a project with existing catalog data.
npm run dev
```

Requires Node.js 22.13 or later. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`.

## Structure

- `app/` routes (Server Components by default), `proxy.ts` refreshes Supabase sessions
- `lib/supabase/` `client.ts` (browser), `server.ts` (server), `admin.ts` (secret key, server-only), `proxy.ts`
- `lib/db/queries/` reusable server-side queries
- `lib/validations/` shared Zod schemas
- `lib/email/`, `emails/` Resend client and React Email templates
- `components/ui` shadcn-style primitives, `components/layout`, `components/shared`
- `supabase/migrations/` SQL schema and RLS

## Supabase Auth setup

- Authentication -> URL Configuration: Site URL = NEXT_PUBLIC_SITE_URL; add Redirect URL `<site>/auth/callback`.
- Authentication -> Providers -> Email: enable email provider and 'Confirm email'.
- Optional (works across browsers): in the Confirm signup and Reset password email templates use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup` (`type=recovery` for reset, plus `&next=/auth/reset-password`).

# ForgeGym — Gym Management SaaS

A production-ready multi-tenant gym management platform. Each gym operates in complete isolation with its own members, membership plans, attendance, and payments. A Super Admin oversees all gyms from a single dashboard.

## Tech Stack

- **Frontend:** Next.js 13 (App Router), React, TypeScript, Tailwind CSS
- **UI:** Lucide icons, Framer Motion, Recharts, React Three Fiber (login page only)
- **Backend:** Next.js API routes (Node.js runtime)
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth with server-side Supabase clients and cookie-backed sessions
- **QR:** qrcode (generation), html5-qrcode (scanning)

## Local Development

Use a dedicated local or non-production Supabase project for development.
Never point test scripts at production data.

### Prerequisites

- **Docker Desktop** (running) — [install](https://docs.docker.com/desktop/)
- **Node.js** 20.x and npm
- **Supabase CLI** — install globally:
  ```bash
  npm install -g supabase
  ```

### Quick Start

```bash
# 1. Install the locked dependencies
npm ci

# 2. Start Supabase locally (Docker)
supabase start

# 3. Inspect local service URLs and keys; keep them local
supabase status -o env

# 4. Configure the required values in an ignored local environment file
#    (for example .env.local); see Environment Variables below.

# 5. Apply pending migrations to the local database
supabase migration up --local

# 6. Start the Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Staff access requires an
account provisioned in the selected Supabase project; public staff sign-up is
disabled. Do not reuse production credentials in local development.

### Useful local URLs

| Service | URL |
|---|---|
| App (dev) | http://localhost:3000 |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |

### Local Development Commands

```bash
supabase start    # Start local Supabase stack
supabase stop     # Stop local Supabase stack
supabase status   # Show local service URLs and local keys; do not share its output
npm run dev       # Start Next.js dev server (port 3000)
npm run typecheck
npm run lint
npm run test:unit
```

`supabase db reset` is destructive: use it only with a disposable local
database. Never run reset/seed scripts against a shared or production project.

## Environment Variables

Set secrets in an ignored local file or the deployment platform's secret
manager. Do not commit real values or expose server credentials through
`NEXT_PUBLIC_*`.

| Variable | Required | Purpose |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL used by browser and server clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public Supabase client key |
| `SUPABASE_URL` | Server fallback | Supabase URL when the public URL is not set |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side operations | Privileged admin operations; never expose to the browser |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Public origin for auth, forms, and payment callbacks |
| `SITE_URL` | Optional fallback | Server-side public-origin fallback for payment links |
| `PORT` | Production custom server | Listening port; `server.js` requires a positive integer |
| `NODE_ENV` | Deployment | Set to `production` for production builds/runtime |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_CAUMAS_TO` | Optional | Registration, setup, and notification email delivery |
| `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_ENVIRONMENT` | Optional | Registration payment gateway; salt is server-only |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENVIRONMENT`, `CASHFREE_API_VERSION` | Optional | Cashfree integration configuration; secret is server-only |
| `MUSIC_PROVIDER`, `AUDIUS_API_KEY`, `PIXABAY_API_KEY` | Optional | Music provider selection and provider API credentials |

`NEXT_PUBLIC_*` values are included in the client build; set them before
`npm run build`. `AUTH_SECRET` / `JWT_SECRET` are referenced only by the
deprecated `lib/auth.ts` module, not the current Supabase session flow.

## Production Build

```bash
npm ci
npm run build
npm start
```

Or use the custom server entry:

```bash
npm run build
node server.js
```

The custom `server.js` entry requires `PORT` to be configured.

## Architecture

```
Browser → Next.js App Router (pages + route handlers) → Supabase Auth / PostgreSQL
```

- **UI:** `app/` contains route pages and API handlers; `components/` contains
  shared UI and feature components.
- **Application services:** `lib/` contains auth/session, Supabase clients,
  payment/email helpers, forms, member operations, and music-provider logic.
- **Data:** `supabase/migrations/` is the ordered schema and policy history;
  `lib/database.types.ts` contains generated Supabase types.
- **Access control:** middleware protects staff pages; API handlers also check
  role and tenant/branch scope. Database RLS/RPC policies are an additional
  boundary, not a replacement for route-level authorization.
- **Roles:** `super_admin` is platform-wide; `gym_owner`, `gym_admin`,
  `manager`, `staff`, and `trainer` are gym-portal roles with different
  permissions; `member` accounts cannot sign in to the staff portal.
- **Music:** the global client player requests approved catalog metadata from
  `/api/music/tracks`; audio is loaded only when playback begins and streams
  from the configured provider/CDN.
- **Attendance:** QR scans call the `check_in` database RPC, which validates
  tenant, membership, branch access, duplicate check-ins, and capacity before
  writing to `visits`.

## Project Structure

```
app/
  api/            Authentication, gym/member, attendance, payment, form, music, registration APIs
  gym/            Staff portal pages and layouts
  super-admin/    Platform administration pages
  auth/           Supabase auth callbacks and password reset
  register/       Public SaaS registration and payment pages
  f/              Public gym form pages
components/
  ui/             Shared Radix-based UI components
  gym/            Gym-specific reusable components
  music/          Persistent player and audio hook
  marketing/      Public landing and registration UI
lib/
  supabase/       Browser, server, and middleware clients
  music/          Provider abstraction, catalog, and shuffle service
  *.ts            Auth, membership, payments, forms, mail, and domain helpers
middleware.ts     Route protection and role enforcement
server.js         Custom production server entry
supabase/         PostgreSQL migrations, local Supabase config, and seed data
```

The current workspace contains 39 API route files, approximately 66 page/API
TypeScript files under `app/`, 72 component files, and 37 library TypeScript
files. The repository is a single full-stack Next.js application, not a
multi-package monorepo.

## Database

The database is Supabase PostgreSQL. Apply the complete, ordered
`supabase/migrations/` history; do not treat the earliest schema migrations as
the current schema or run demo seeds in production.

| Area | Existing tables / records |
|---|---|
| Tenancy and access | `gyms`, `gym_branches`, `profiles`, `users`, `staff_branch_access`, `trainer_members` |
| Members and billing | `members`, `membership_plans`, `memberships`, `payments` |
| Attendance | `visits` (active QR check-in flow), `attendance` (also present in schema history) |
| Platform operations | `notifications`, `support_grants`, `audit_logs` |
| Music | `music_tracks`, `music_settings` |
| SaaS registration | `gym_os_registration_requests`, `gym_os_coupons`, `gym_os_coupon_redemptions` |
| Custom forms | `gym_forms`, `gym_form_sections`, `gym_form_fields`, `gym_form_submissions` |

Migrations also define foreign keys, indexes, RLS policies, triggers, storage
policies, and RPCs such as `check_in` and `submit_gym_os_registration`.
The `attendance` and `visits` tables coexist; verify their historical callers
before attempting a consolidation.

## API Endpoints

All APIs are under `/api`. Protected endpoints require a valid staff session
and enforce role/tenant access. Public registration, public forms, music
catalog, and auth callback routes are intentionally public.

| Area | Methods and paths |
|---|---|
| Auth | `POST /auth/login`, `/auth/logout`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`; `GET /auth/me` |
| Dashboard | `GET /dashboard` |
| Gyms | `GET, POST /gyms`; `GET, PUT, DELETE /gyms/{id}` |
| Members | `GET, POST /members`; `GET, PUT, DELETE /members/{id}`; `GET /members/{id}/qr`; `GET, POST /members/{id}/photo` |
| Attendance | `GET, POST /attendance`; `PUT /attendance/{id}` |
| Plans and payments | `GET, POST /plans`; `PUT, DELETE /plans/{id}`; `GET, POST /payments`; `PATCH /payments/{id}` |
| Gym forms | `GET, POST /gym-forms`; `GET /gym-forms/files`; `GET, PUT, PATCH, DELETE /gym-forms/{id}`; `POST /gym-forms/{id}/duplicate`; `GET /gym-forms/submissions`; `GET, PATCH, DELETE /gym-forms/submissions/{id}` |
| Public forms | `GET /public/forms/{publicId}`; `POST /public/forms/{publicId}/submit` |
| Music | `GET /music/tracks`, `/music/tracks/{id}`, `/music/stream/{id}`; `GET /music/admin/tracks`; `POST /music/admin/import`; `GET, PATCH, DELETE /music/admin/tracks/{id}` |
| Public registration/payment | `POST /register`, `/register/quote`, `/register/payment`, `/register/payment/verify`, `/register/payment/webhook`; `GET, POST /register/payment/callback` |

The `GET /attendance` API accepts `memberId`, `gymId` (Super Admin only),
`from`, `to`, `page`, and `limit`. Page size is capped at 1,000; the staff
history screen requests 20 rows per page.

## Testing and Verification

```bash
npm run test:unit     # Pure pagination/date validation tests (no database writes)
npm run typecheck     # TypeScript compiler
npm run lint          # Next.js ESLint checks
npm run build         # Production compilation
```

The login/RBAC smoke script requires a running app and an isolated test account:

```powershell
$env:TEST_ADMIN_USERNAME = "<test staff username>"
$env:TEST_ADMIN_PASSWORD = "<test staff password>"
$env:TEST_BASE_URL = "http://127.0.0.1:3000"
node test-login-rbac.js
```

Do not use production credentials or data for testing. The smoke script covers
login, invalid credentials, protected-page access, and unauthenticated
redirects; it is not a complete QR/attendance lifecycle suite. End-to-end
account provisioning, QR creation/scanning, check-in, checkout, and database
synchronization can be exercised against a dedicated disposable Supabase
project. Start the app built with that project's local Supabase URL and keys,
then configure a seeded Super Admin account:

```powershell
$env:TEST_BASE_URL = "http://127.0.0.1:3300"
$env:TEST_ADMIN_USERNAME = "<disposable Super Admin username>"
$env:TEST_ADMIN_PASSWORD = "<disposable Super Admin password>"
$env:E2E_ALLOW_DATA_CREATION = "YES"
npm run test:e2e:lifecycle
```

This test creates a gym, gym-owner account, plan, member, payment, and visit;
it verifies QR generation and scan behavior, duplicate/invalid operations,
checkout, and API-visible database synchronization. It refuses non-loopback
URLs and requires the explicit data-creation flag. Use only a fresh, disposable
test database. The QR scan is exercised through the same token/API contract as
the scanner; physical-camera/browser permission behavior is not covered.

## Security Checklist

- [x] Supabase Auth handles staff password authentication and sessions
- [x] Middleware enforces route protection and role-based access
- [x] API routes enforce role/tenant access and database RLS/RPC policies
- [x] Platform and gym roles are permission-gated at route and database boundaries
- [x] Service-role, SMTP, and payment secrets are server-only configuration
- [x] Member QR tokens are random opaque tokens; member details are fetched separately

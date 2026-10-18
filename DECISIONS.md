# Architecture Decisions

This document records the architecture visible in the current codebase and
small, compatibility-preserving decisions made during the maintenance pass.
It does not authorize schema changes or removal of legacy behavior.

## Current architecture

| Concern | Current decision | Evidence / consequence |
|---|---|---|
| Application boundary | One full-stack Next.js 13 App Router application | UI routes live in `app/`; HTTP handlers live in `app/api/`; deploy through the custom `server.js` entry |
| UI composition | Route pages compose shared components; common primitives live in `components/ui/` | Gym, marketing, music, and visual components have separate feature folders |
| Business and integration logic | Shared server/domain helpers live under `lib/` | Supabase clients, auth/roles, payments, mail, forms, member helpers, and music providers are not implemented exclusively inside page components |
| Persistence | Supabase PostgreSQL with versioned SQL migrations | `supabase/migrations/` is the schema/policy history; `lib/database.types.ts` represents generated database contracts |
| Authentication and authorization | Supabase Auth sessions; middleware guards staff pages; APIs enforce role checks; RLS and RPCs enforce database access | Never treat hidden UI or middleware as the only authorization boundary |
| Tenant model | Gyms own branches and operational records; staff roles constrain access | Gym and branch scope must remain enforced in the API and database |
| QR attendance | An opaque per-member token is resolved by the `check_in` RPC; active check-ins are stored as `visits` | Keep duplicate, membership-status, branch-access, and capacity outcomes atomic with the database write |
| Music integrations | The player depends on a provider abstraction and consumes an approved catalog API | Provider changes should not be coupled to player UI or expose provider credentials in browser code |
| Configuration | Public Supabase URL/key are client-visible; service, payment, SMTP, and provider secrets remain server-only | `NEXT_PUBLIC_*` values are build-time public values and must never contain privileged credentials |

## Decisions made in this maintenance pass

### Keep current route and payload contracts

Refactoring remains incremental. Existing pages and API paths stay in place;
new organization must not silently rename routes or change payload meaning.
`GET /api/attendance` retains its `data` field and adds pagination metadata.
Its legacy no-argument behavior is bounded to the configured Supabase row
maximum; the staff history UI now requests 20 records per page.

### Bound attendance history work at the API

Attendance history is ordered and paginated by the server rather than loading
up to the full database row limit and slicing in the browser. Page size is
capped at 1,000 and excessive offsets are rejected. Date-only filters must be
real `YYYY-MM-DD` dates and the start date cannot follow the end date.

### Avoid unnecessary music downloads and stale catalog replacement

The audio element uses `preload="none"` so the browser does not fetch a track
before the user starts playback. Catalog requests are abortable; stale context
responses cannot overwrite newer selections. A cached catalog is used only
when it belongs to the saved playlist context. Non-success responses retain
the existing catalog rather than replacing it with an empty list.

### Keep existing data and migrations intact

The schema contains both `attendance` and `visits`, and the live QR/check-in
path uses `visits`. No consolidation, destructive migration, or seed reset is
included without a verified migration plan and an isolated test database.

## Deferred decisions

- Whether the older `attendance` table can be retired, or has consumers that
  still require dual-read/dual-write behavior.
- Whether payment configuration and stored fields should be normalized:
  the registration payment path uses PayU while some persistence names and
  Cashfree configuration remain in the codebase.
- Whether login throttling should move from process-local memory to a shared
  rate-limit store before horizontal scaling.
- Which isolated test project and browser/camera strategy should be used for
  full account-to-attendance end-to-end verification.

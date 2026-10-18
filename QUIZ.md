# Project Questions and Answers

## Current behavior

### Can staff create their own accounts from the login page?

No. `POST /api/auth/signup` is disabled and returns `403`. Staff accounts are
provisioned through administrative workflows and backed by Supabase Auth.

### Which database record represents a QR check-in?

The current QR flow calls the `check_in` RPC and writes a row to `visits`.
An older `attendance` table also exists in the migration history; it should
not be assumed to be interchangeable with `visits`.

### Does the QR code contain the member's name or phone number?

No. Member creation generates an opaque random token. Staff reads the token
through the scoped QR endpoint and the check-in RPC resolves it to a member.

### What happens when the same QR code is scanned twice without checkout?

The database RPC detects the open visit and returns an
`already_checked_in` result. The API responds with `409`; it does not insert a
second open visit.

### Is gym/branch isolation enforced only by the UI?

No. Middleware and API role checks protect application entry points, while
Supabase RLS/RPC checks enforce database access and branch/gym scope.

### Does changing the playlist eagerly download audio?

No. The player loads catalog metadata separately and now sets the audio
element to `preload="none"`. Track audio is requested after Play.

### Which automated checks currently exist?

The added unit suite covers attendance pagination and date validation.
Typecheck, lint, and production build scripts are configured. The existing
login/RBAC smoke test needs a dedicated test account. The full camera-to-
database lifecycle suite has not been run.

## Decisions still needing product/operations input

1. Should legacy callers of `attendance` be migrated to `visits`, or must the
   two records remain synchronized?
2. Which gateway is authoritative for new SaaS registration payments: PayU or
   Cashfree? The current route uses PayU while legacy Cashfree names/config
   remain.
3. Which isolated Supabase project and seeded test identities should CI/E2E
   use? Production and shared local data must not be reset by tests.
4. Is automated QR scanning required in CI? If so, should CI use a browser
   camera mock with generated QR frames, or keep camera permission/device
   verification as a documented manual test?
5. What is the intended history retention/maximum page depth for attendance?
   The API currently rejects offsets beyond one million rows.
6. Should sign-in rate limiting remain best-effort per server process, or
   should production deployment provide a shared rate-limit backend?

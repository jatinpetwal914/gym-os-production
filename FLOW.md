# Application Workflows

## 1. Staff account provisioning and authentication

1. Public staff self-signup is intentionally disabled:
   `POST /api/auth/signup` returns `403`.
2. A Super Admin or authorized gym administrator provisions a gym/staff
   account through the administration workflow. The identity is managed by
   Supabase Auth and its application role/tenant association is represented by
   the profile data.
3. The staff member submits credentials to `POST /api/auth/login`.
4. The route resolves a username to its Auth identity when needed, verifies
   the password with Supabase Auth, and rejects inactive/member accounts and
   suspended gyms.
5. Supabase SSR session cookies carry the authenticated identity. Middleware
   protects staff pages; API handlers independently enforce role and tenant
   permissions.
6. `GET /api/auth/me` reports the current session. `POST /api/auth/logout`
   clears it. Forgot/reset routes use the configured Supabase/site URL and
   email integration.

## 2. Member creation and QR issuance

1. An authorized staff member creates a member through `POST /api/members`.
2. The handler validates the submitted member/plan data, derives gym scope
   from the session for gym-scoped roles, generates an opaque 32-byte random
   QR token, and persists the member.
3. The member detail UI retrieves the QR payload through
   `GET /api/members/{id}/qr`; the QR encodes the token, not the member's
   personal details.
4. The ordinary member response deliberately omits the QR token.

## 3. QR scan, check-in, and persistence

1. Staff opens `/gym/attendance` over HTTPS, grants camera access, and starts
   the QR scanner.
2. `html5-qrcode` decodes the QR value. The UI prevents concurrent scans while
   a check-in request is being processed.
3. The UI posts `{ "qr_token": "..." }` to `POST /api/attendance`.
4. The API authenticates the staff session, checks check-in permission,
   selects the session's home/default branch when one was not explicitly
   provided, and calls the `check_in` PostgreSQL RPC.
5. The RPC validates branch access, gym ownership, trainer assignment,
   membership status, duplicate open visits, and branch capacity within its
   database transaction. It writes a `visits` row with method `qr` on success.
6. A successful new check-in returns `201` and includes the member/visit
   summary. A duplicate open check-in returns `409` with
   `alreadyCheckedIn: true`. Invalid, expired, inactive, out-of-scope, or
   capacity-rejected requests return an error and do not create another visit.
7. The UI displays the returned member identity and photograph state so staff
   can verify the person before allowing entry.

## 4. Check-out and attendance history

1. Authorized staff checks out a visit through
   `PUT /api/attendance/{visitId}`. If no checkout time is supplied, the API
   uses the current server time.
2. The handler verifies gym scope, rejects missing/already-closed visits and
   checkout times before the check-in time, then conditionally updates only an
   open visit. Concurrent duplicate checkout attempts receive `409`.
3. `GET /api/attendance` filters by tenant and optional member/date criteria.
   It returns ordered records with `page`, `limit`, and `total`; the staff
   history UI fetches 20 rows at a time.

## 5. Public SaaS registration and payment

1. A visitor requests a quote through `POST /api/register/quote` and submits
   registration through `POST /api/register`.
2. Registration validation and idempotency are performed by the
   `submit_gym_os_registration` database RPC; email delivery follows the
   database result and a delivery failure is surfaced as a notice.
3. Paid registrations request a PayU checkout through
   `POST /api/register/payment`. Provider callbacks/webhooks are validated
   before `applyVerifiedPayUPayment` records a payment result.
4. Free-coupon registrations can trigger registration/setup emails without a
   gateway payment.

## 6. Public forms and member synchronization

1. A public form is read through `GET /api/public/forms/{publicId}` and
   submitted through `POST /api/public/forms/{publicId}/submit`.
2. Submission and follow-up processing persist form responses. Depending on
   the configured form behavior, member-sync helpers can create a gym member
   with a fresh QR token and optional photo storage.
3. Gym staff review forms and submissions through the protected
   `/api/gym-forms` endpoints.

## 7. Music catalog and playback

1. Authenticated portal pages mount one global player at the root layout;
   public landing/login/register surfaces do not render it.
2. The player reads a short-lived browser catalog cache keyed by playlist
   context, then requests `GET /api/music/tracks?context=...`.
3. The server returns approved track metadata and provider stream URLs. On an
   upstream/catalog failure it returns an error status; the client keeps its
   last usable catalog.
4. Audio is fetched only after a user presses Play. Playback state and shuffle
   history are local to that browser, so navigation does not stop playback.

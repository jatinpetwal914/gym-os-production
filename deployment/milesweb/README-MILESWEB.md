# Gym OS — MilesWeb Node.js / cPanel deploy

Extract this ZIP into the Node.js **application root** (not `public_html` as the app root).

**DO NOT** upload `.env`.
**DO NOT** upload `node_modules`.
**DO NOT** expose `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`).

## 1. Upload / extract

Upload `gym-os-milesweb-production.zip` and extract so `package.json` and `server.js` sit in the application root.

## 2. cPanel → Setup Node.js App

Create (or edit) the application:

| Field | Value |
|---|---|
| Node.js version | **20.x** (18.x if 20 is unavailable) |
| Application mode | **Production** |
| Application root | e.g. `gymos` (`/home/<user>/gymos`) |
| Application URL | your domain or subdomain |
| Application startup file | `server.js` |

## 3. Environment variables

Add these in the Node.js App UI **before** building. Use `.env.example.milesweb` as the name list. Real values come from gymos Project → Settings → API.

Required:

- `NODE_ENV=production`
- `NEXT_PUBLIC_SITE_URL=https://your-domain` (no trailing slash)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL` (same Cloud URL)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (registration and password setup emails)
- `SMTP_CAUMAS_TO` (internal registration notifications)

Optional: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `MUSIC_PROVIDER`, `AUDIUS_API_KEY`, `PIXABAY_API_KEY`

`PORT` is set by Passenger. Do not hardcode it.

`NEXT_PUBLIC_*` is baked in at **build** time. Set them before `npm run build`.

## 4. Install

In the application root (SSH or the Node.js terminal):

```bash
npm ci --omit=dev
```

If `npm ci` is unavailable:

```bash
npm install --omit=dev
```

## 5. Build

```bash
npm run build
```

If the host runs out of memory, build on a Linux machine with the **same** production `NEXT_PUBLIC_*` values, then upload `.next`.

## 6. Start

Start / restart the app in Setup Node.js App.

Startup file: `server.js`  
Start command: `node server.js`

## 7. Domain and SSL

Point the domain at this Node app. Install SSL (Let’s Encrypt in cPanel). Use `https://` in `NEXT_PUBLIC_SITE_URL`.

## 8. Supabase Dashboard

In gymos Project → Authentication → URL configuration:

- Site URL = `https://your-domain`
- Redirect URLs include `https://your-domain/auth/callback` and `https://your-domain/auth/reset`

Do not point the app at `127.0.0.1:54321`.

## 9. Tests after go-live

1. Open `/` and `/login`.
2. `GET /api/auth/me` with no cookie → 401 `{ "authenticated": false }` (not a 500).
3. Super Admin login → `/super-admin/dashboard`.
4. Gym Owner login → `/gym/dashboard`.
5. Confirm a Gym A user cannot see Gym B data.
6. Create a test gym with an owner email and verify the first-login setup link arrives and can set a password.
7. Request a password reset using both username and email; each link should open `/auth/reset`.

Unauthenticated `/gym/dashboard` and `/super-admin/dashboard` should redirect to login, not crash.

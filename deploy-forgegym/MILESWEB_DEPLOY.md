# 🚀 MilesWeb Hosting — Quick Deploy Guide (ForgeGym)

This guide is **specific to MilesWeb shared hosting with Node.js support (mPanel)**.

---

## 1. Requirements (MilesWeb Plan)

Your MilesWeb plan must include **Node.js support** (mPanel / Node.js app hosting).
- Node.js **18 or higher**
- The app uses **Supabase Cloud** for its database — **no MySQL/PostgreSQL needed on MilesWeb**.

---

## 2. Upload & Extract

1. Log in to **MilesWeb mPanel** → **Node.js App Manager** (or cPanel equivalent).
2. Create a new Node.js application:
   - **Node version:** 18.x or 20.x
   - **Application root:** e.g. `/home/yourusername/apps/forgegym` (or the folder you extracted the zip into)
   - **Startup file:** `server.js`
3. Upload `forgegym-milesweb-deploy.zip` via **File Manager** and extract it into the app folder.
4. **Important:** Files extracted from the zip must be at the **root of the app folder** (`package.json` directly inside it — not inside a sub-folder).

---

## 3. Set Environment Variables

In mPanel → Node.js App → **Environment Variables**, add:

```
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://khygsyfugymapapzfkue.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Paste-your-service-role-key-here>
NEXT_PUBLIC_SUPABASE_URL=https://khygsyfugymapapzfkue.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdzeWZ1Z3ltYXBhcHpma3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzIyODIsImV4cCI6MjEwMjQ0ODI4Mn0.65yqZU3SY5i7sm9gacB-PC5hTp0u91l3RJNLKLTeYDc
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_98ZQKinkSFF4Jbm3Mple1A_A2K5gmdf
```

> ⚠️ **SUPABASE_SERVICE_ROLE_KEY is REQUIRED** for username login and gym admin operations.
> Get it from: Supabase Dashboard → Settings → API → service_role key.
> **Never** expose it in the browser — it's server-side only (the `.env` file in this zip has it blank).

---

## 4. Install & Build

Open the **Node.js App Manager terminal** (or SSH) and run:

```bash
cd /home/yourusername/apps/forgegym
npm install
npm run build
```

> `npm install` downloads all dependencies (~560 MB on disk). This takes a few minutes.

---

## 5. Start & Point Domain

1. Click **Start / Restart** on the Node.js app in mPanel.
   - The app starts with `node server.js` (listens on port 3000).
2. **Map your domain/subdomain** in mPanel so it proxies to port 3000:
   - mPanel → Node.js App → your app → **Domains** → Add your domain
   - It automatically creates the reverse proxy to `127.0.0.1:3000`.
3. Enable **SSL/HTTPS** (Let's Encrypt) for your domain — required for the QR scanner (camera APIs need a secure context).

---

## 6. Verify

- [ ] Visit `https://yourdomain.com` — you should see the ForgeGym landing page
- [ ] `/login` works — log in as `superadmin` (see DEPLOYMENT.md for the demo credentials)
- [ ] `/api/music/tracks` returns `{"data":[]}` or track data (not a 500)
- [ ] Add a gym → add a member → create a plan → record attendance → record a payment

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| Blank page after login | Check mPanel logs: `console` → application logs |
| API 403 errors | `SUPABASE_SERVICE_ROLE_KEY` wrong or missing |
| Redirect loop | Clear cookies; restart the Node.js app |
| QR scanner black | Site not on HTTPS — enable SSL |
| Port conflict | Set `PORT=3000` (or another free port) and map your domain to it |
| Build fails / OOM | Use a higher Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=2048` |

---

**Files included in this package:**
- `server.js` — custom Next.js server (recommended start file for mPanel)
- `package.json` — scripts: `dev`, `build`, `start`
- `next.config.js` — build config
- `.env` — pre-filled with Supabase **anon** keys (service_role key blank — you must add it)
- `app/`, `components/`, `lib/`, `public/`, `scripts/`, `supabase/` — source code
- `DEPLOYMENT.md` — full deployment + DB migration guide
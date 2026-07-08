# AIMS — Deployment Guide

Production deploy to **Vercel** with **Supabase** (Postgres + Auth + Storage).

## 1. Prerequisites
- Supabase project (already created): `qxugdiydxxlxnmgnnwyq`
- Tables applied: `npx prisma migrate deploy` (done)
- Storage bucket **`aims-documents`** created (Storage → New bucket) with a policy
  allowing authenticated users to upload/read
- A login created in Supabase → Authentication → Users (tick *Auto Confirm*)

## 2. Push to GitHub
The repo is already on GitHub: `shishirsambabu/aims`, branch
`claude/exciting-lamport-3wVaI`. Merge to `main` when ready.

## 3. Connect Vercel
1. vercel.com → **Add New → Project** → import `shishirsambabu/aims`.
2. Framework preset: **Next.js** (auto-detected).
3. **Root Directory**: set to the folder containing `package.json`
   (i.e. the repo root / `.claude` path that holds `app/`, `package.json`).
4. Build command stays `next build`; install runs `npm install` (which triggers
   `prisma generate` via the postinstall hook).

## 4. Environment variables (Vercel → Settings → Environment Variables)
Add these for **Production** (and Preview):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qxugdiydxxlxnmgnnwyq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Supabase → Settings → API → anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase → Settings → API → service_role) |
| `DATABASE_URL` | the **pooler** URL (Session mode, port 5432) — `postgresql://postgres.<ref>:<pwd>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres` (encode `@` in the password as `%40`) |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL, e.g. `https://aims.vercel.app` |
| `CRON_SECRET` | long random secret used by scheduled jobs |
| `RESEND_API_KEY` | Resend key for invoice, receipt, and credit-note email outbox |
| `EMAIL_FROM` | verified sender, e.g. `AIMS ERP <noreply@aedenfruits.com>` |
| `SENTRY_DSN` | Sentry DSN for error alerting |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL for shared rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `ENFORCE_MFA` | set to `true` only after admin/finance users enroll MFA |
| `AEDEN_GSTIN` | Aeden GSTIN shown on printable invoices |
| `DEFAULT_FRUIT_HSN_CODE` | default fruit HSN code, usually `0810` unless finance changes it |

> Use the **pooler** connection string, not the direct `db.<ref>.supabase.co:5432`
> host (that one is IPv6-only and Vercel's build/runtime can't reach it).

## 5. Supabase Auth redirect URLs
Supabase → Authentication → URL Configuration → add your Vercel URL to
**Site URL** and **Redirect URLs** (e.g. `https://aims.vercel.app/auth/callback`).

## 6. Apply migrations to production DB
Already applied via `npx prisma migrate deploy` against the pooler URL. Re-run it
whenever the schema changes.

## 7. Smoke test (after deploy)
- [ ] Sign in (password + magic link)
- [ ] Create a container; confirm it appears in the list and on the Kanban
- [ ] Costs/Sales tabs compute rate-per-box and profit/margin
- [ ] Upload a document → appears in Documents with expiry highlighting
- [ ] Add a payment → outstanding total updates
- [ ] Issue an invoice → journal entry posts and invoice print page opens
- [ ] Record a receipt → journal entry posts and email outbox row is queued
- [ ] Export Finance → Tally day-book CSV for the current period
- [ ] Analytics KPIs + charts render
- [ ] Settings → Excel Import: upload the tracker sheet, preview, import
- [ ] Team page: change a member's role (as admin)

## 8. Local development
```bash
npm install
cp .env.example.txt .env.local   # then fill Supabase values and set DATABASE_URL to the pooler URL
npm run dev                     # http://localhost:3001
```

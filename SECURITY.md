# AIMS — Security Hardening (Phase 17)

## In-app protections (already built)
- **Role-based access control** — central capability matrix (`lib/permissions.ts`);
  every API route checks `can(role, capability)`. Field-level: viewers / clearing
  agents don't see cost/profit/payment data.
- **Maker-checker** — payments need a different approver; cost sheets lock on
  finalize.
- **Org scoping** — every Prisma query is scoped to the user's `org_id`.
- **Private document storage** — files are served via short-lived **signed URLs**
  (`/api/documents/[id]/file`), never public URLs. Uploads are type/size limited
  (PDF/JPG/PNG ≤25MB).
- **Audit trail** — every mutation and sensitive read (document open, P&L view) is
  written to `activity_log` (viewable at Settings → Audit Log).
- **Rate limiting** — expensive endpoints (`/api/import`, `/api/containers/bulk`)
  are throttled per user (`lib/ratelimit.ts`).
- **Soft-delete** — containers are archived (`deleted_at`), never hard-deleted.

## One-time setup you should do
1. **Enable RLS** — run `prisma/rls.sql` in the Supabase SQL Editor (defense in
   depth against direct anon-key API access; the app keeps working via Prisma).
2. **Make the storage bucket private** — Supabase → Storage → `aims-documents` →
   set to **Private**. (Signed URLs already handle reads.)
3. **🔴 Rotate the committed keys** — `.env.local.txt` in the repo contains live
   Supabase keys. Rotate them (Supabase → Settings → API → roll keys) and remove
   that file from git history.
4. **Backups** — enable Point-in-Time Recovery on the Supabase project.

## Notes
- The in-memory rate limiter is best-effort (per server instance). For strict
  limits across instances, back it with Upstash/Redis later.

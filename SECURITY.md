# AIMS ERP Security Controls

## Enforced in the application

- Database-backed, fail-closed sessions. Supabase metadata never grants an ERP role.
- Invite-only access. A user must have an active `public.users` profile.
- Central capability matrix for API, page, and navigation access.
- Organization scoping on operational reads and writes.
- Maker-checker controls for payments, customer changes, sales quotes, sales orders, and cycle-count posting.
- Server-side floor-price and margin redaction, including revision snapshots.
- Atomic document numbering and conditional stock updates.
- Expiring stock reservations with audited automatic release.
- Revenue recognition from dispatched sales-order quantities, not order approval.
- Private document storage with signed reads and validated upload metadata.
- RLS denial of direct `anon` and `authenticated` table access.
- Transactional audit entries for critical sales, receipt, reservation, and numbering workflows.
- Optional MFA enforcement for admin, GM, and finance roles through Supabase AAL2.
- Redis-backed rate limiting for expensive routes when Upstash credentials are configured.
- Sentry-compatible error reporting through `SENTRY_DSN`.
- Transactional email outbox for invoice, receipt, and credit-note communication.

## Required production configuration

1. Keep the `aims-documents` Supabase bucket private.
2. Set `CRON_SECRET` in Vercel for reservation-release jobs.
3. Rotate any Supabase or database credential that has ever appeared in Git history.
4. Enable Supabase point-in-time recovery and perform a documented restore drill.
5. Connect application logs and `/api/health` to an external alerting provider.
6. Add malware scanning before allowing untrusted external uploads.
7. Set `ENFORCE_MFA=true` after admin, GM, and finance users enroll factors.
8. Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `SENTRY_DSN`, `AEDEN_GSTIN`, and `DEFAULT_FRUIT_HSN_CODE`.

## Known residual controls

- Audit coverage is strongest for financial and inventory-critical paths; continue moving older CRUD logs into their mutation transactions.
- WhatsApp Business, e-invoice GSP, OCR jobs, and external WMS/Tally sync still need live vendor credentials and staging contracts before production enablement.

# AIMS Operations Runbook

This runbook defines the minimum production operating procedures for AIMS -
Aeden International Management System.

## Error Monitoring

1. Set `SENTRY_DSN` in Vercel and verify a test error reaches the incident channel.
2. Enable platform log retention for the production deployment.
3. Treat repeated errors in payment, document, import or supplier approval routes
   as priority incidents.
4. Poll `/api/health` every minute and alert after two consecutive `503` responses.

## Reservation Release

1. Set `CRON_SECRET` in Vercel; the scheduled job calls `/api/jobs/daily`.
2. The daily job releases expired reservations and flushes the email outbox.
3. Investigate any `EXPIRED_RESERVATION_STATE_CONFLICT` as an inventory incident.
4. Managers can invoke `/api/sales-orders/release-expired` while authenticated if an immediate release is required.

## Email Outbox

1. Set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel.
2. Invoice, credit-note and receipt workflows enqueue email inside the same
   transaction as the business document.
3. `/api/jobs/email-outbox` can be invoked with `Authorization: Bearer <CRON_SECRET>`
   to retry pending communication immediately.
4. Messages older than one hour in `Retry` or `Sending` status are operational
   incidents because customers may not have received finance communication.

## Shared Rate Limiting

1. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel.
2. Bulk/import routes use Redis when configured and fall back to local memory
   only for development.

## Slow Query Monitoring

1. Set `AIMS_LOG_QUERIES=1` in a staging or production diagnostic window.
2. Set `AIMS_SLOW_OPERATION_MS=750` unless the production baseline requires a
   stricter threshold.
3. Watch logs for `[monitoring:slow] prisma.query`.
4. For recurring slow queries, capture:
   - route or user action that triggered the query
   - query duration
   - table/index involved
   - row count if available from Supabase
5. Disable verbose query logging after diagnosis if log volume becomes noisy.

## Backup SOP

1. Use Supabase automated daily backups for the production database.
2. Before major schema migrations, trigger a manual backup or confirm the latest
   point-in-time recovery window.
3. Export the production environment variable list without secret values and
   store it with deployment notes.
4. Keep document storage in a private Supabase bucket and include the bucket in
   the storage backup policy.
5. Record every backup verification in the release checklist.

## Restore SOP

1. Open an incident and freeze non-critical deployments.
2. Identify the restore target time and confirm business impact with operations.
3. Restore the database to a temporary project first when time allows.
4. Run `npm run db:deploy` against the restored database to align migrations.
5. Smoke test login, dashboard, containers, documents, payments and reports.
6. Switch production traffic only after finance and operations approve the
   restored data snapshot.
7. Document the incident cause, data loss window and prevention action.

## Restore Drill Evidence

1. Run a restore into a temporary Supabase project at least once per quarter.
2. Apply migrations with `npx prisma migrate deploy` against the restored target.
3. Smoke test login, dashboard, CRM, warehouse, sales, finance, document upload,
   invoice print, receipt posting and Tally day-book export.
4. Record tester, restore timestamp, RPO/RTO achieved, failed checks and fixes.

## Credential Rotation SOP

1. Rotate Supabase service/database credentials from the Supabase dashboard.
2. Update production deployment secrets.
3. Redeploy AIMS.
4. Run smoke tests on `localhost:3001` or staging, then production.
5. Remove old credentials from any shared notes or screenshots.
6. Confirm old credentials no longer authenticate.

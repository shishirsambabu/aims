# AIMS Operations Runbook

This runbook defines the minimum production operating procedures for Aeden
Imports Management System (AIMS).

## Error Monitoring

1. Enable platform log retention for the production deployment.
2. Route application logs containing `[monitoring:error]` to the incident channel.
3. Treat repeated errors in payment, document, import or supplier approval routes
   as priority incidents.
4. When a provider is selected, connect `lib/monitoring.ts` to Sentry, Datadog,
   OpenTelemetry or the chosen logging platform.
5. Poll `/api/health` every minute and alert after two consecutive `503` responses.

## Reservation Release

1. Set `CRON_SECRET` in Vercel; the scheduled job calls `/api/sales-orders/release-expired` every 15 minutes.
2. Investigate any `EXPIRED_RESERVATION_STATE_CONFLICT` as an inventory incident.
3. Managers can invoke the same endpoint while authenticated if an immediate release is required.

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

## Credential Rotation SOP

1. Rotate Supabase service/database credentials from the Supabase dashboard.
2. Update production deployment secrets.
3. Redeploy AIMS.
4. Run smoke tests on `localhost:3001` or staging, then production.
5. Remove old credentials from any shared notes or screenshots.
6. Confirm old credentials no longer authenticate.

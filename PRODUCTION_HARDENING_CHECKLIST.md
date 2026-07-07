# AIMS ERP Production Hardening Checklist

## Completed

- [x] Fail-closed, profile-backed authentication and invite-only access.
- [x] API and core-page capability checks with organization scoping.
- [x] Financial-field redaction from current records and revision history.
- [x] Maker-checker for payments, customers, quotes, orders, and cycle counts.
- [x] Atomic sales, quote, receipt, CRM, gate-pass, and cycle-count numbering.
- [x] Database constraints preventing negative inventory and invalid dispatch quantities.
- [x] Concurrency-aware stock reserve, release, count, and dispatch updates.
- [x] Reservation expiry and automated audited release.
- [x] Dispatch-based container sales and margin recognition.
- [x] Finance document backbone for sales invoices, customer returns, and credit notes.
- [x] Reason-controlled cancellation for invoices, returns, and credit notes.
- [x] Return posting with audited stock movement when accepted back into inventory.
- [x] Private document delivery and upload metadata validation.
- [x] RLS denial for direct client table access.
- [x] Health endpoint, CI workflow, lint, unit tests, TypeScript, and production build gates.

## Required Before Company-Wide Rollout

- [ ] Rotate historical credentials and verify old credentials are revoked.
- [ ] Configure `CRON_SECRET`, external uptime monitoring, error alerting, and log retention.
- [ ] Complete and evidence a database plus document-storage restore drill with agreed RPO/RTO.
- [ ] Add shared distributed rate limiting for bulk/import routes.
- [ ] Add browser end-to-end tests for role access, quote-to-cash, receiving-to-dispatch, and reservation expiry.
- [ ] Add GST-compliant printable invoice formats, e-invoice fields, journal posting, bank reconciliation, and period close.
- [ ] Add multi-line return receiving with QC photos, customer dispute resolution, and approval matrix for high-value credits.
- [ ] Add cold-room temperature telemetry, stock transfers, UoM conversions, and recall traceability.
- [ ] Add CRM activity history, lead conversion, duplicate merge, consent, and communication integrations.
- [ ] Complete WMS and accounting integration contracts in staging before live credentials are enabled.
- [ ] Pilot one warehouse and one sales region with signed SOP/UAT evidence before expansion.

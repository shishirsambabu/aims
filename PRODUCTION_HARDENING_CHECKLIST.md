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
- [x] GST invoice print page with GSTIN, HSN, taxable value and e-invoice placeholders.
- [x] Tally-compatible day-book export from posted journal entries.
- [x] Automatic journal posting for invoices, receipts, and credit notes.
- [x] Email outbox plus Resend delivery worker for finance communications.
- [x] CRM activity timeline API for calls, WhatsApp notes, meetings, and follow-ups.
- [x] Procurement purchase-order API with estimated-vs-actual landed-cost variance.
- [x] FX-rate master API for controlled USD/AED/INR rate capture.
- [x] Reason-controlled cancellation for invoices, returns, and credit notes.
- [x] Return posting with audited stock movement when accepted back into inventory.
- [x] Private document delivery and upload metadata validation.
- [x] RLS denial for direct client table access.
- [x] Health endpoint, Sentry-compatible error reporting, CI workflow, lint, unit tests, TypeScript, and production build gates.
- [x] Upstash Redis-backed rate limiting path with local fallback.
- [x] MFA enforcement path for admin/GM/finance roles when `ENFORCE_MFA=true`.

## Required Before Company-Wide Rollout

- [ ] Rotate historical credentials and verify old credentials are revoked.
- [ ] Configure `CRON_SECRET`, `RESEND_API_KEY`, `SENTRY_DSN`, `UPSTASH_*`, external uptime monitoring, and log retention in Vercel.
- [ ] Complete and evidence a database plus document-storage restore drill with agreed RPO/RTO.
- [ ] Add browser end-to-end tests for role access, quote-to-cash, receiving-to-dispatch, and reservation expiry.
- [ ] Connect a GSP/ClearTax-style e-invoice provider if AIMS must generate IRN/QR directly instead of Tally.
- [ ] Complete full bank statement CSV auto-match UI, period-close approval evidence, and dunning ladder UAT.
- [ ] Add multi-line return receiving with QC photos, customer dispute resolution, and approval matrix for high-value credits.
- [ ] Add cold-room temperature telemetry, stock transfers, UoM conversions, and recall traceability.
- [ ] Add lead conversion UI, duplicate merge UI, consent capture, and WhatsApp Business integration.
- [ ] Complete WMS and accounting integration contracts in staging before live credentials are enabled.
- [ ] Pilot one warehouse and one sales region with signed SOP/UAT evidence before expansion.

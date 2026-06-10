# AIMS Roadmap: Phases 21-24

This roadmap turns AIMS from a strong internal tracker into a workflow-led import
operations platform. The sequence is intentional: tighten the human SOP loop
first, then automate documents, then upgrade reporting, then connect external
systems.

## Guiding Principles

- SOP before integrations: external systems should feed a clean workflow, not
  create more exceptions.
- Exceptions first: users should see blocked/risky work before routine data.
- Role-aware by default: clearing, finance, management and audit should not see
  the same priority queue.
- Audit everything: automation should never hide who/what changed a record.
- Provider-agnostic integrations: ICEGATE, Tally, carriers, OCR and email should
  plug into a shared integration layer instead of being hardcoded into pages.

## Phase 21 - Personal Workbench + Alert Routing

Goal: make the dashboard answer "What needs my attention today?"

Scope:
- Role-aware alert feed for admin, manager, clearing agent, finance, viewer and
  auditor.
- Per-user alert preferences by category.
- Per-user alert state: unread/read, snoozed, resolved.
- Dashboard "My Workbench" with critical tasks, detention/free-day risk and next
  best actions.
- Alert actions: mark read, snooze, resolve.
- Detention/free-day alerts surfaced as high-priority in-app push candidates.

Out of scope for this phase:
- WhatsApp/SMS/email delivery.
- Browser push subscriptions.
- External provider keys.

Exit criteria:
- A user's dashboard shows role-relevant alerts only.
- Dismissed/resolved alerts no longer clutter that user's active queue.
- Snoozed alerts return after the snooze window.
- Alert counts respect user role and preferences.

## Phase 22 - Document Automation + File Packaging

Goal: reduce manual document handling while preserving human verification.

Scope:
- Bulk document zip download per container.
- File auto-compression for large images/PDFs before storage where practical.
- Email-to-doc ingestion foundation.
- Attachment matching by Container No, BL No, invoice no and supplier.
- OCR extraction queue with confidence scores.
- Human review screen for extracted fields before applying to records.

Provider candidates:
- Email: Microsoft Graph / Outlook is the preferred path; setup is blocked
  until the Microsoft 365 admin account is available.
- OCR: Google Document AI, Azure AI Document Intelligence, AWS Textract or
  Mindee.
- Storage: continue using Supabase Storage.

Exit criteria:
- Users can download a complete container dossier as a zip.
- Inbound documents can be queued, matched and reviewed.
- OCR suggestions never mutate operational records without review/acceptance.

## Phase 23 - Analytics v2 + Export Center

Goal: move from charts to management-grade reporting.

Scope:
- Export Center for PDF/Excel reports.
- Scheduled management reports.
- Analytics drill-downs for supplier performance, detention leakage, customs
  delay, port performance, landed-cost variance, ETA vs ATA accuracy and AP
  aging.
- Report permissioning through existing financial/audit capabilities.

Candidate libraries:
- Excel: `exceljs` for formatted workbooks.
- PDF: server-rendered HTML-to-PDF or `@react-pdf/renderer`.

Exit criteria:
- Managers can export monthly operational and financial packs.
- Finance can export AP aging and container P&L.
- Reports match UI totals and respect role-based financial visibility.

## Phase 24 - Integrations Layer

Goal: connect AIMS to external systems without turning the core app into
provider-specific spaghetti.

Scope:
- Shared integration framework:
  - provider registry
  - encrypted credential references
  - sync runs
  - sync errors
  - external references
  - retry/audit logs
- Adapter folders:
  - `lib/integrations/tally`
  - `lib/integrations/icegate`
  - `lib/integrations/carriers`
  - `lib/integrations/email`
  - `lib/integrations/ocr`
- Manual "test connection" and "sync now" workflows.
- Dry-run previews before data mutation.

Provider notes:
- Tally should start with export/import or controlled API sync, depending on the
  deployment environment.
- ICEGATE integration needs legal/provider feasibility confirmation before
  committing to automation.
- Carrier integrations should begin with event/status ingestion, not booking
  mutation.

Exit criteria:
- Integrations are auditable, retryable and reversible.
- Failed syncs are visible to admins/managers.
- External provider data maps into existing SOP stages, not around them.

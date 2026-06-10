# AIMS Production Hardening Checklist

This checklist tracks what must be completed before Aeden Imports Management
System (AIMS) is treated as production-ready ERP software.

## Critical Controls

- [x] Replace hard deletes with soft deletes / archive flow for documents.
- [x] Replace hard deletes with soft deletes / archive flow for payments.
- [x] Replace hard deletes with safe supplier deactivation or protected archive.
- [x] Force auth fallback to read-only `viewer` if the database is unreachable.
- [x] Remove public document URL fallback from document downloads.
- [ ] Backfill or manually review any legacy documents that have only `fileUrl`
  and no private storage `filePath`.
- [ ] Rotate Supabase/database credentials that were previously present in a
  tracked env template.

## Data Integrity / ERP Workflow

- [ ] Imported sales should enter a reviewable state before becoming operational.
- [x] Imported payments should enter a reviewable state before becoming payable.
- [ ] Add reason prompts for destructive, financial and workflow reversal actions.
- [ ] Add explicit audit metadata for before/after values on key financial edits.
- [ ] Add approval controls for supplier master data changes.

## Security / Dependency Risk

- [x] Upgrade vulnerable `next` version through a controlled framework upgrade.
- [x] Replace or isolate vulnerable `xlsx` usage.
- [ ] Add rate limits to all mutation, upload, export and import endpoints.
- [ ] Add stricter upload scanning/validation for documents and spreadsheets.
- [ ] Add production security headers/CSP review.

## Reliability / Operations

- [ ] Add automated tests for SOP stage gates.
- [ ] Add automated tests for role permissions and financial visibility.
- [ ] Add automated tests for payment maker-checker.
- [ ] Add automated tests for import validation.
- [ ] Add automated tests for document verification and dossier downloads.
- [ ] Add production error monitoring.
- [ ] Add slow-query and failed-sync monitoring.
- [ ] Define backup/restore SOP.

## UI / UX Production Polish

- [ ] Add lifecycle timeline to container detail.
- [ ] Add saved table views and column visibility.
- [ ] Add sticky table headers and density controls.
- [ ] Add mobile task-first dashboard.
- [ ] Add empty/error/loading states with business-friendly recovery actions.

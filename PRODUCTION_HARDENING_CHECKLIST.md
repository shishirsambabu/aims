# AIMS Production Hardening Checklist

This checklist tracks what must be completed before Aeden Imports Management
System (AIMS) is treated as production-ready ERP software.

## Critical Controls

- [x] Replace hard deletes with soft deletes / archive flow for documents.
- [x] Replace hard deletes with soft deletes / archive flow for payments.
- [x] Replace hard deletes with safe supplier deactivation or protected archive.
- [x] Force auth fallback to read-only `viewer` if the database is unreachable.
- [x] Remove public document URL fallback from document downloads.
- [x] Add an audit script for legacy documents that have only `fileUrl` and no
  private storage `filePath`.
- [x] Run the legacy document audit and backfill or manually review any findings.
- [ ] Rotate Supabase/database credentials that were previously present in a
  tracked env template.

## Data Integrity / ERP Workflow

- [x] Imported sales should enter a reviewable state before becoming operational.
- [x] Imported payments should enter a reviewable state before becoming payable.
- [x] Add reason prompts for destructive, financial and workflow reversal actions.
- [x] Add explicit audit metadata for before/after values on key financial edits.
- [x] Add approval controls for supplier master data changes.

## Security / Dependency Risk

- [x] Upgrade vulnerable `next` version through a controlled framework upgrade.
- [x] Replace or isolate vulnerable `xlsx` usage.
- [x] Add rate limits to all mutation, upload, export and import endpoints.
- [x] Add stricter upload validation for document metadata and private storage paths.
- [ ] Add malware scanning for uploads once a scanning provider is selected.
- [x] Add production security headers/CSP review.

## Reliability / Operations

- [x] Add automated tests for SOP stage gates.
- [x] Add automated tests for role permissions and financial visibility.
- [x] Add automated tests for payment maker-checker.
- [x] Add automated tests for import validation.
- [x] Add automated tests for document verification and dossier downloads.
- [x] Add production error monitoring hooks and operating procedure.
- [x] Add slow-query monitoring hooks and operating procedure.
- [ ] Connect external monitoring provider and alert routing.
- [x] Define backup/restore SOP.

## UI / UX Production Polish

- [ ] Add lifecycle timeline to container detail.
- [ ] Add saved table views and column visibility.
- [ ] Add sticky table headers and density controls.
- [ ] Add mobile task-first dashboard.
- [ ] Add empty/error/loading states with business-friendly recovery actions.

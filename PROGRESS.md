# AIMS — Build Progress

> This file is updated by the orchestrator agent after each phase completes.
> DO NOT manually edit unless resetting a phase.

## Phase Status

| Phase | Name | Status | Completed By | Notes |
|-------|------|--------|--------------|-------|
| 1 | Foundation (Setup + Auth + Layout) | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Build passes. Live DB migration blocked — see Blockers |
| 2 | Container Tracker Core | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Build passes (17 routes). Runtime needs DB — see Blockers |
| 3 | Cost, Sales & Profit Engine | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Formulas unit-verified; build passes |
| 4 | Document Manager | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Build passes (21 routes). Needs Supabase bucket `aims-documents` |
| 5 | Shipment Kanban | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Build passes (21 routes). @dnd-kit board |
| 6 | Payments Tracker | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Build passes (23 routes) |
| 7 | Analytics Dashboard | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Build passes (23 routes). Recharts |
| 8 | Excel Import | ✅ Complete (2026-06-08) | orchestrator + qa-reviewer | Build passes (25 routes). SheetJS |
| 9 | Polish, QA & Deploy | ✅ Code complete (2026-06-08) | orchestrator + qa-reviewer | Build passes (26 routes). Vercel deploy = user (DEPLOY.md) |

## IDMS Expansion (Phases 10+)

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| 10 | Workflow State Machine & Stage Gates | ✅ Complete (2026-06-08) | Guarded transitions gated on docs (BoE→Cleared, DO→In Warehouse) + sales; UI locks + Kanban enforced via API |
| 11 | Approvals, Maker-Checker & Cost Lock | ✅ Complete (2026-06-08) | New roles (clearing_agent/finance/auditor) + capability matrix; cost-sheet finalize/unlock; payment maker-checker; field-level financials gating |
| 12 | Demurrage/Detention + Notifications Center | ✅ Complete (2026-06-09) | Free-day deadline per container w/ countdown; /alerts page (demurrage, doc expiry, overdue/pending payments, loss-making, flagged); Alerts nav badge |
| 13 | Reports Module | ✅ Complete (2026-06-09) | /reports hub (profit by supplier/port, AP aging, date-range); printable per-container P&L at /print/container/[id] |
| 14 | Master Data Management + Validation | ✅ Complete (2026-06-09) | Supplier CRUD (/settings/suppliers) + ports/customers reference; ISO 6346 Container No validation; masterdata.write capability |
| 15 | Landed-Cost Accuracy & Multi-Currency | ✅ Complete (2026-06-09) | IGST + Cess in landing cost; per-currency payment rollups (USD/AED/INR never summed together) |
| 16 | Global Search, Bulk Ops & Audit Viewer | ✅ Complete (2026-06-09) | /search cross-entity; container bulk status/flag/archive; /settings/audit; soft-delete (deleted_at) |
| 17 | Security Hardening | ✅ Complete (2026-06-09) | Signed-URL doc serving (private bucket); rate limiting; access logging; RLS SQL (prisma/rls.sql) + SECURITY.md |
| 18 | Container Data Model v2 + Arrival Importer | ✅ Complete (2026-06-09) | POL/POD, origin, line, vessel, transhipment, package type, per-pkg weight, ATA, DO upto, empty return, transit; free-time auto-calc from ETA; shipper-invoice upload on create; multi-sheet arrival importer (418 rows verified) |
| 19 | Arrival/ATA Workflow + ETA Revision | ✅ Complete (2026-06-09) | Mark-Arrived (ATA) action; ETA-day arrival prompts (alerts + dashboard badge); ETA revision keeps originalEta; free time recomputed from ATA |
| 20 | Pipeline v2 + Team Handoff | ✅ Complete (2026-06-09) | New "Empty Returned" stage after In Warehouse; Kanban handoff divider (Docs team → Sales team) |
| 21 | Personal Workbench + Alert Routing | ✅ Code complete (2026-06-10) | Roadmap file for Phases 21-24; per-user alert preferences/state; role-aware dashboard workbench; personal alert center with read/snooze/resolve actions |
| 22 | Document Automation + File Packaging | ✅ Foundation complete (2026-06-10) | Container dossier ZIP download; JPG/PNG upload compression; document automation job schema/API/settings page; email/OCR providers pending keys |
| 23 | Analytics v2 + Export Center | ✅ Foundation complete (2026-06-10) | Management Excel/CSV exports; export center UI; analytics v2 decision metrics for detention leakage, ETA variance and customs cycle |
| 24 | Integrations Layer | ✅ Foundation complete (2026-06-10) | Provider-agnostic connections, sync runs, sync errors and external references; Settings → Integrations; adapters pending provider credentials/admin access |
| 25 | Enterprise Design Overhaul | ✅ Complete (2026-07-07) | Flat enterprise design language (see GAP_AUDIT_REPORT.md): DM Sans/Inter/JetBrains per spec; flat navy sidebar; compact primitives (button/card/table/input/select/tabs/badge); data-first dashboard rewrite; route-group loading skeleton; not-found page; breadcrumb labels; decorative utilities (mesh-panel/command-surface/glass) redefined flat |

### Phase 10 — Workflow State Machine (done)
- [x] `lib/workflow.ts` — `canTransition`/`allowedTransitions`/`stageRequirement`
- [x] Stage gates: Customs Clearance←BoL, Cleared←Bill of Entry, In Warehouse←Delivery Order, Partially/Fully Sold←sales recorded; backward = logged correction
- [x] Server enforcement in PATCH `/api/containers/[id]` (409 + reason); Kanban inherits it
- [x] Detail UI: status dropdown locks blocked stages (🔒) + live "to advance…" checklist

### Phase 21 — Personal Workbench + Alert Routing Checklist
- [x] Roadmap created for Phases 21-24 (`ROADMAP_PHASES_21_24.md`)
- [x] Phase 21 schema added: `user_alert_preferences` and `user_alert_states`
- [x] Phase 21 migration added and applied: `20260610113000_phase21_personal_alerts`
- [x] Alert data layer upgraded (`lib/data/notifications.ts`) with role routing, personal preferences, read/snooze/resolve state, unread counts and detention counts
- [x] Personal alert badge counts wired into dashboard layout/sidebar (`getPersonalNavCounts`)
- [x] API added: `PATCH /api/alerts/state` for read, snooze, resolve and reopen
- [x] API added: `PATCH /api/alerts/preferences` for per-user category toggles
- [x] Dashboard upgraded with role-aware "My Work Today" workbench, critical/unread counts and detention watch panel
- [x] Alerts page upgraded into "My Alert Center" with active queue, preference toggles and read/snooze/resolve actions
- [x] Reusable alert UI controls added: `AlertActions` and `AlertPreferences`
- [x] Production build passes after Phase 21 changes
- [ ] Manual role-by-role smoke test on localhost:3001

### Phase 22 — Document Automation + File Packaging Checklist
- [x] Container dossier ZIP endpoint added: `GET /api/containers/[id]/documents/zip`
- [x] Dossier ZIP includes private Supabase documents via signed URLs and a `MANIFEST.txt`
- [x] Container Documents tab now exposes `Download Dossier ZIP`
- [x] Container Documents tab now exposes secure open-file links for uploaded docs
- [x] Large JPG/PNG uploads are compressed client-side before storage
- [x] Document automation queue schema added: `document_automation_jobs`
- [x] Phase 22 migration added: `20260610124500_phase22_document_automation`
- [x] API added: `GET/POST /api/document-automation/jobs`
- [x] Settings page added: `/settings/document-automation`
- [ ] Connect email provider keys (Microsoft Graph or Gmail)
- [ ] Connect OCR provider keys (Document AI / Azure / Textract / Mindee)
- [ ] Build human OCR review/accept screen after provider choice
- [ ] Add malware scanning for uploads once a scanning provider is selected
- [ ] Manual dossier ZIP test on localhost:3001
- [ ] Revisit GoDaddy/domain email ingestion provider path; Outlook is not currently used

### Phase 23 — Analytics v2 + Export Center Checklist
- [x] Server-side management report export endpoint added: `GET /api/reports/management`
- [x] Excel workbook export added with Summary, Supplier Performance, Ports and AP Aging sheets
- [x] CSV export added for quick sharing
- [x] Reports page upgraded with Phase 23 Export Center card
- [x] Dedicated Export Center page added: `/reports/exports`
- [x] Analytics v2 decision metrics added: detention leakage, ETA variance and customs cycle
- [x] Financial export access respects `financials.view`
- [x] Server-generated PDF report pack
- [ ] Scheduled email report delivery; blocked until Outlook admin account is available
- [ ] Manual Excel/CSV download test on localhost:3001

### Phase 24 — Integrations Layer Checklist
- [x] Integration connection schema added: `integration_connections`
- [x] Integration run schema added: `integration_runs`
- [x] Integration error schema added: `integration_errors`
- [x] External reference schema added: `external_references`
- [x] Phase 24 migration added: `20260610133000_phase24_integrations_foundation`
- [x] API added: `GET/POST /api/integrations`
- [x] API added: `POST /api/integrations/[id]/runs` for test/dry-run placeholders
- [x] Settings page added: `/settings/integrations`
- [x] Settings hub linked to Integrations
- [ ] Outlook adapter credentials; blocked until admin account is available
- [ ] Tally adapter implementation
- [ ] ICEGATE feasibility/provider confirmation
- [ ] Carrier event ingestion adapter

## Phase 1 — Foundation Checklist
- [x] `npx create-next-app@14` with TypeScript + Tailwind
- [x] Install and init Shadcn/ui (components hand-authored under `components/ui/`)
- [x] Install: prisma, @prisma/client, @supabase/supabase-js, zustand, @tanstack/react-table, recharts (+ @supabase/ssr, react-hook-form, zod, sonner, @dnd-kit, xlsx)
- [x] Create `.env.local` with Supabase credentials (gitignored)
- [x] Write full `prisma/schema.prisma` (all 10 tables incl. activity_log)
- [~] Run `prisma migrate dev --name init` — **BLOCKED** (DB unreachable from sandbox, IPv6-only). Migration SQL generated & committed under `prisma/migrations/`; apply with `prisma migrate deploy` once a reachable connection string is set.
- [x] Create `lib/supabase/{client,server,middleware}.ts` and `lib/prisma.ts`
- [x] Build login page (`app/(auth)/login/page.tsx`) — password + magic link
- [x] Build signup/invite page (+ forgot-password)
- [x] Supabase auth middleware (`middleware.ts` + `lib/supabase/middleware.ts`)
- [x] Build layout shell: sidebar + topnav (`app/(dashboard)/layout.tsx`)
- [x] `components/layout/Sidebar.tsx` — dark navy (#16325C), nav items with icons
- [x] `components/layout/TopNav.tsx` — breadcrumb, global search (Container No + BL No), user menu
- [x] Dashboard home placeholder (`app/(dashboard)/page.tsx`) — KPI cards
- [x] Routable placeholders for all nav modules (containers/shipments/documents/payments/analytics/settings)

## Phase 2 — Container Tracker Checklist
- [x] `app/(dashboard)/containers/page.tsx` — full TanStack table (sortable, alternating rows)
- [x] Columns: Sl No, Container No, BL No, Supplier, Port, Status, Profit (Actions = row-click)
- [x] Filter bar: Port, Supplier, Status, Date range (URL-driven via `ContainerFilters`)
- [x] Global search: by Container No AND BL No simultaneously (filter bar + TopNav)
- [x] Row-click → navigate to detail
- [x] `app/(dashboard)/containers/[id]/page.tsx` — 7-tab detail (`ContainerDetail`)
- [x] Tab 1: Overview (identity fields + inline status change w/ PATCH)
- [x] Tab 2: Customs & Invoice (invoice + BE fields, weights)
- [x] Tab 3: Costs & Landing (duty, clearing, liner, detention, CHA, transport, totals — display; engine in Phase 3)
- [x] Tab 4: Sales & Profit (KPI cards, margin colour-coded; engine in Phase 3)
- [x] Tab 5: Documents (X/9 completeness checklist + list; upload in Phase 4)
- [x] Tab 6: Payments (requests + status; full flow in Phase 6)
- [x] Tab 7: Activity Log (timeline)
- [x] `app/(dashboard)/containers/new/page.tsx` — add container form (react-hook-form)
- [x] `components/containers/StatusBadge.tsx` (container + document + payment variants)
- [x] API routes: GET/POST `/api/containers`, GET/PATCH `/api/containers/[id]` — org-scoped, Zod-validated, activity-logged, role-gated
- [x] Data layer `lib/data/containers.ts`, `lib/auth.ts` (session/org context), `lib/activity.ts`, `lib/validations/container.ts`

## Phase 3 — Cost & Finance Checklist
- [x] Auto-calculate total cost from individual cost fields (`lib/finance.ts` `computeCost`)
- [x] Rate Per Box — Landing = Total Cost / Boxes; Final = Landing + OH − Claim (per finance-engine.md)
- [x] Profit Per Container = Sale Value − Damage Value − Total Cost
- [x] Profit Per Box = Profit / Sold Qty
- [x] Profit Margin % = (Profit / Sale Value) × 100
- [x] Color code: green (>10%), yellow (0-10%), red (<0%) — `marginColor`/`marginClass`
- [x] API routes for costs and sales — PUT `/api/containers/[id]/costs` & `/sales` (upsert + recompute, cost edit re-syncs cached profit)
- [x] Editable `CostPanel` & `SalesPanel` on tabs 3 & 4 with live client-side recalculation
- [x] Formulas unit-verified (total cost, rate/box, profit, margin)
- Note: Total Cost includes **BE Invoice Value INR** per finance-engine.md — added
  `be_invoice_value_inr` + `exchange_rate` + `rate_per_box_landing` to `container_costs`;
  init migration regenerated (still unapplied — DB blocker).

## Phase 4 — Document Manager Checklist
- [x] `app/(dashboard)/documents/page.tsx` — master doc list
- [x] Columns: Type, Doc No, Container No, BL No, Supplier, Issue Date, Expiry Date, Status
- [x] Filter: Doc Type, Status, Container (search/containerId param), Expiry (≤30 days toggle)
- [x] Red highlight: expiring ≤30d (amber row), ≤7d/expired (red row + "Expiring Soon"/"Expired" badge)
- [x] Upload flow: select container (by Container No or BL No), doc type, doc no, dates, file
- [x] Supabase Storage integration — client upload to `aims-documents`, path `{org}/{container}/{type}/{file}`, PDF/JPG/PNG ≤25MB
- [x] Document completeness score per container (X/9) — container list column (red 0 / yellow <5 / green) + detail Tab 5
- [x] Missing doc checklist on container detail Tab 5 (+ inline upload button)
- [x] API routes: GET/POST `/api/documents`, PATCH(verify)/DELETE `/api/documents/[id]`
- Note: status enum value `Received` → `Uploaded` (aligns with doc-manager flow Pending→Uploaded→Verified); init migration regenerated.
- **Supabase setup needed:** create Storage bucket `aims-documents` with policies allowing authenticated upload/read.

## Phase 5 — Shipment Kanban Checklist
- [x] `app/(dashboard)/shipments/page.tsx`
- [x] 8-column kanban (Booked → Fully Sold)
- [x] Container card: Container No, BL No, Supplier, Port, Item, Boxes (+ flag)
- [x] Drag-and-drop to update status (@dnd-kit) — optimistic move + PATCH, reverts on error
- [x] Filter by Port and Supplier
- [x] Click card → opens container detail (via card "open" button → detail page; viewers are read-only, no drag)

## Phase 6 — Payments Tracker Checklist
- [x] `app/(dashboard)/payments/page.tsx`
- [x] Table: Container No, BL No, Supplier, Amount Requested, Paid, Outstanding, Due, Status
- [x] Status: Pending / Partial / Paid (color badges) — auto-derived from amounts
- [x] Add payment request modal (`PaymentForm`) — container, amount, currency, dates, ref/notes
- [x] Summary cards: total outstanding, total paid, total requested (overdue due-dates flagged red)
- [x] Record-payment + delete actions; API GET/POST `/api/payments`, PATCH/DELETE `/api/payments/[id]`
- Note: summary totals are shown in USD (primary import currency); per-currency rollup deferred (most payments are USD/AED).

## Phase 7 — Analytics Dashboard Checklist
- [x] `app/(dashboard)/analytics/page.tsx`
- [x] KPI cards: Total Containers, Total Invoice Value, Total Profit, Avg Margin %, Pending Docs, Outstanding Payments
- [x] Chart 1: Profit by Container (horizontal bar, sorted, green/red by sign)
- [x] Chart 2: Profit by Supplier (donut)
- [x] Chart 3: Containers by Port (bar)
- [x] Chart 4: Monthly Volume (line)
- [x] Chart 5: Profit Trend (line)
- [x] Table: Top 5 profitable containers
- [x] Table: Bottom 5 / loss-making containers
- [x] Supplier summary table (containers, total profit, avg margin)
- Data layer `lib/data/analytics.ts` (single-pass JS aggregation); Recharts in
  `AnalyticsCharts`; `KPICard`. tsconfig target bumped to ES2017.

## Phase 8 — Excel Import Checklist
- [x] Install `xlsx` (SheetJS) package
- [x] `app/api/import/route.ts` — commit endpoint (validate, dedupe, insert per-row in a transaction)
- [x] Column mapping from existing tracker columns → DB fields (`lib/import/mapping.ts`, header-normalised, Excel serial dates)
- [x] Duplicate detection by Container No (client preview flag + server authoritative skip)
- [x] Preview table before confirming import (first 10 rows, Ready/Duplicate/Missing counts)
- [x] Error report for problem rows + downloadable CSV
- [x] Import UI at `app/(dashboard)/settings/import/page.tsx` (`ImportWizard`) + Settings hub
- Note: import auto-creates suppliers by name; recomputes cost/profit via the finance engine; maps to existing schema fields (sheet-only columns like route/warehouse/tally are ignored).

## Phase 9 — Polish & Deploy Checklist
- [x] Activity log (written to activity_log on every mutation across all APIs)
- [x] Team management page (`settings/team/page.tsx`) + `PATCH /api/team/[id]` (admin-only role changes)
- [x] Mobile responsive sidebar (Zustand `useUiStore` drawer + TopNav hamburger)
- [x] Export to Excel button on container list (`ExportButton`, SheetJS)
- [x] Toast notifications (Sonner — success/error on all mutations)
- [x] Global search in TopNav (Container No + BL No → `/containers?q=`)
- [x] Notification badges: expiring docs, pending payments, flagged containers (`getNavCounts` → Sidebar)
- [x] Push to GitHub (handed off via zip; user pushes from local — write-scoped session would push directly)
- [ ] Connect to Vercel — **user** (see `DEPLOY.md`)
- [ ] Set Vercel environment variables — **user** (table in `DEPLOY.md`; use the pooler `DATABASE_URL`)
- [x] Run `prisma migrate deploy` on production DB (applied to Supabase via pooler)
- [ ] Smoke test all modules — checklist in `DEPLOY.md`
- [ ] Share URL with team — **user**

## Discovered Issues / Blockers
<!-- Agents append here when they hit a problem -->
- **[Phase 1] Live DB migration blocked.** The Supabase *direct* connection host
  `db.qxugdiydxxlxnmgnnwyq.supabase.co:5432` resolves to an IPv6-only address and
  this build sandbox has no IPv6 egress (`P1001: can't reach database server`).
  General HTTPS egress works (Supabase REST reachable over IPv4). The `init`
  migration SQL is generated and committed under `prisma/migrations/`.
  **To apply:** set `DATABASE_URL` to the Supabase **Supavisor pooler** string
  (`postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`)
  or enable the IPv4 add-on, then run `npm run db:deploy`. Auth already works at
  runtime (Supabase Auth is reached over HTTPS), so login/signup are unaffected.
- **[Phase 1] `.env.local.txt` contains live secrets and is committed to the repo**
  (from the initial setup commit, pre-dating this session). The working
  `.env.local` is gitignored. Recommend rotating these keys and removing
  `.env.local.txt` from version control.

## Architecture Decisions Log
<!-- Agents append here when they make a significant decision -->
- Using @dnd-kit for kanban drag-and-drop (lighter than react-beautiful-dnd, maintained)
- Supabase Row Level Security enabled — org_id on every table
- Prisma for type-safe queries; Supabase client only for auth and file storage
- [Phase 1] App lives at the repo root (not a `fruitgate-pro/` subdir) — the Next.js
  app, `app/`, `components/`, `lib/`, `prisma/` sit alongside the existing `agents/`,
  `rules/` and project-memory files.
- [Phase 1] Pinned **Prisma to ^6** (not 7). Prisma 7 removed `url = env()` from the
  datasource and the classic `prisma migrate dev` flow this project is built around;
  v6 keeps the documented workflow intact.
- [Phase 1] Auth uses **@supabase/ssr** (`createBrowserClient`/`createServerClient`)
  rather than the deprecated `@supabase/auth-helpers-nextjs`. Cookie-based session
  refresh runs in `middleware.ts`.
- [Phase 1] shadcn/ui primitives are hand-authored under `components/ui/` (Radix +
  CVA) instead of via the interactive `shadcn` CLI, for reproducible non-interactive
  builds. Design tokens live as HSL CSS vars in `app/globals.css`; brand colours
  (#16325C sidebar, #0070D2 primary, #2E844A/#C23934 profit-loss) in `tailwind.config.ts`.

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
| 5 | Shipment Kanban | ⬜ Not Started | — | — |
| 6 | Payments Tracker | ⬜ Not Started | — | — |
| 7 | Analytics Dashboard | ⬜ Not Started | — | — |
| 8 | Excel Import | ⬜ Not Started | — | — |
| 9 | Polish, QA & Deploy | ⬜ Not Started | — | — |

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
- [ ] `app/(dashboard)/shipments/page.tsx`
- [ ] 8-column kanban (Booked → Fully Sold)
- [ ] Container card: Container No, BL No, Supplier, Port, Item, Boxes
- [ ] Drag-and-drop to update status (react-beautiful-dnd or @dnd-kit)
- [ ] Filter by Port and Supplier
- [ ] Click card → opens container detail modal

## Phase 6 — Payments Tracker Checklist
- [ ] `app/(dashboard)/payments/page.tsx`
- [ ] Table: Container No, BL No, Supplier, Amount Requested, Date, Status
- [ ] Status: Pending / Partial / Paid (color badges)
- [ ] Add payment request modal
- [ ] Summary row: total outstanding, total paid
- [ ] API routes for payments

## Phase 7 — Analytics Dashboard Checklist
- [ ] `app/(dashboard)/analytics/page.tsx`
- [ ] KPI cards: Total Containers, Total Invoice Value, Total Profit, Avg Margin %, Pending Docs, Outstanding Payments
- [ ] Chart 1: Profit by Container (horizontal bar, sorted)
- [ ] Chart 2: Profit by Supplier (donut)
- [ ] Chart 3: Containers by Port (stacked bar)
- [ ] Chart 4: Monthly Volume (line)
- [ ] Chart 5: Profit Trend (line)
- [ ] Table: Top 5 profitable containers
- [ ] Table: Bottom 5 / loss-making containers
- [ ] Supplier summary table

## Phase 8 — Excel Import Checklist
- [ ] Install `xlsx` (SheetJS) package
- [ ] `app/api/import/route.ts` — parse uploaded Excel
- [ ] Column mapping from existing tracker columns → DB fields
- [ ] Duplicate detection by Container No
- [ ] Preview table before confirming import
- [ ] Error report for rows with missing required fields
- [ ] Import UI at `app/(dashboard)/settings/import/page.tsx`

## Phase 9 — Polish & Deploy Checklist
- [ ] Activity log (write to activity_log table on every mutation)
- [ ] Team management page (`settings/team/page.tsx`)
- [ ] Mobile responsive sidebar (collapse on small screens)
- [ ] Export to Excel button on container list
- [ ] Toast notifications (success/error on all mutations)
- [ ] Global search in TopNav (container no + BL no → navigate to record)
- [ ] Notification badges: expiring docs, pending payments, flagged containers
- [ ] Push to GitHub
- [ ] Connect to Vercel
- [ ] Set Vercel environment variables
- [ ] Run `prisma migrate deploy` on production DB
- [ ] Smoke test all modules
- [ ] Share URL with team

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

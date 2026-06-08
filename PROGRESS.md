# AIMS — Build Progress

> This file is updated by the orchestrator agent after each phase completes.
> DO NOT manually edit unless resetting a phase.

## Phase Status

| Phase | Name | Status | Completed By | Notes |
|-------|------|--------|--------------|-------|
| 1 | Foundation (Setup + Auth + Layout) | ⬜ Not Started | — | — |
| 2 | Container Tracker Core | ⬜ Not Started | — | — |
| 3 | Cost, Sales & Profit Engine | ⬜ Not Started | — | — |
| 4 | Document Manager | ⬜ Not Started | — | — |
| 5 | Shipment Kanban | ⬜ Not Started | — | — |
| 6 | Payments Tracker | ⬜ Not Started | — | — |
| 7 | Analytics Dashboard | ⬜ Not Started | — | — |
| 8 | Excel Import | ⬜ Not Started | — | — |
| 9 | Polish, QA & Deploy | ⬜ Not Started | — | — |

## Phase 1 — Foundation Checklist
- [ ] `npx create-next-app@14` with TypeScript + Tailwind
- [ ] Install and init Shadcn/ui
- [ ] Install: prisma, @prisma/client, @supabase/supabase-js, zustand, @tanstack/react-table, recharts
- [ ] Create `.env.local` with Supabase credentials
- [ ] Write full `prisma/schema.prisma` (all 9 tables)
- [ ] Run `prisma migrate dev --name init`
- [ ] Create `lib/supabase.ts` and `lib/prisma.ts`
- [ ] Build login page (`app/(auth)/login/page.tsx`)
- [ ] Build signup/invite page
- [ ] Supabase auth middleware (`middleware.ts`)
- [ ] Build layout shell: sidebar + topnav (`app/(dashboard)/layout.tsx`)
- [ ] `components/layout/Sidebar.tsx` — dark navy, nav items with icons
- [ ] `components/layout/TopNav.tsx` — breadcrumb, global search, user menu
- [ ] Dashboard home placeholder (`app/(dashboard)/page.tsx`)

## Phase 2 — Container Tracker Checklist
- [ ] `app/(dashboard)/containers/page.tsx` — full TanStack table
- [ ] Columns: Sl No, Container No, BL No, Supplier, Port, Status, Profit, Actions
- [ ] Filter bar: Port, Supplier, Status, Date range
- [ ] Global search: by Container No AND BL No simultaneously
- [ ] Row-click → navigate to detail
- [ ] `app/(dashboard)/containers/[id]/page.tsx` — 7-tab detail
- [ ] Tab 1: Overview (container identity fields)
- [ ] Tab 2: Customs & Invoice (BE, invoice fields)
- [ ] Tab 3: Costs & Landing (duty, clearing, liner, detention, CHA, transport, totals)
- [ ] Tab 4: Sales & Profit (sold qty, margin, color-coded)
- [ ] Tab 5: Documents (list + upload)
- [ ] Tab 6: Payments (requests + status)
- [ ] Tab 7: Activity Log (timeline)
- [ ] `app/(dashboard)/containers/new/page.tsx` — add container form
- [ ] `components/containers/StatusBadge.tsx`
- [ ] API routes: GET/POST/PATCH `/api/containers`

## Phase 3 — Cost & Finance Checklist
- [ ] Auto-calculate total cost from individual cost fields
- [ ] Rate Per Box = (Total Cost + OH Proportion - Claim Deduction) / No of Boxes
- [ ] Profit Per Container = Sale Value - Total Cost - Damage Value
- [ ] Profit Per Box = Profit Per Container / Sold Qty
- [ ] Profit Margin % = (Profit / Sale Value) × 100
- [ ] Color code: green (>10%), yellow (0-10%), red (<0%)
- [ ] API routes for costs and sales

## Phase 4 — Document Manager Checklist
- [ ] `app/(dashboard)/documents/page.tsx` — master doc list
- [ ] Columns: Type, Doc No, Container No, BL No, Supplier, Issue Date, Expiry Date, Status
- [ ] Filter: Doc Type, Status, Container, Expiry (next 30 days)
- [ ] Red highlight: docs expiring within 30 days
- [ ] Upload flow: select container (by No or BL), doc type, dates, file
- [ ] Supabase Storage integration for PDF/image upload
- [ ] Document completeness score per container (X/9)
- [ ] Missing doc checklist on container detail Tab 5
- [ ] API routes for documents

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

## Architecture Decisions Log
<!-- Agents append here when they make a significant decision -->
- Using @dnd-kit for kanban drag-and-drop (lighter than react-beautiful-dnd, maintained)
- Supabase Row Level Security enabled — org_id on every table
- Prisma for type-safe queries; Supabase client only for auth and file storage

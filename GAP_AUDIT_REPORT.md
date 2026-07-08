# AIMS — Gap Audit Report (2026-07-07)

Audit of the full codebase: 32 pages, 17 component groups, `lib/` data layer, API routes, tests, and the design system. Two kinds of gaps are covered: **why it doesn't look/feel like a real ERP** and **what's functionally missing**.

---

## 1. Executive summary

The functional depth is real — containers, docs, kanban, payments, warehouse, sales, CRM, finance, reports, imports, roles, workflow gates, audit log all exist with server enforcement. **The problem is not missing features; it is that the product doesn't behave or look like an operations tool.**

The current UI reads as an AI-generated marketing site: gradient hero panels, glassmorphism, mesh backgrounds, 2rem-rounded cards, uppercase tracking-wide labels everywhere, motivational copy ("Act on the bottleneck before it becomes loss") where data should be. Real ERPs (Salesforce Lightning, SAP Fiori, Odoo, NetSuite) are the opposite: **flat, dense, quiet, consistent, fast**.

| Area | Score today | Target |
|---|---|---|
| Feature coverage | 75/100 | 85 |
| Look & feel (enterprise credibility) | ~15/100 | 90+ |
| Perceived speed / feedback | 25/100 | 85 |
| Consistency (spacing, radius, type) | 20/100 | 95 |
| Navigation efficiency | 40/100 | 90 |

---

## 2. Design gaps (why it feels 10/100) — and the fix

### D1. Decoration instead of information ⟵ **fixed in this pass**
- `mesh-panel`, `command-surface`, `glass`, radial-gradient body background, glow orbs, gradient buttons, gradient nav items.
- Dashboard home is 1,380 lines, mostly hero copy; contains dead code (`{false && ...}` KPI grid, unused `DashboardHero` component).
- **Fix:** flat neutral background, white surfaces, 1px borders, one subtle shadow level. Dashboard rebuilt as a data-first cockpit: KPI strip → work queue → module grid. Marketing copy deleted.

### D2. No consistent geometry ⟵ **fixed in this pass**
- Radii used simultaneously: `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-[1.25rem]`, `[1.35rem]`, `[1.5rem]`, `[1.75rem]`, `[2rem]`, `rounded-full` chips. Base `--radius: 0.85rem` is consumer-app sized.
- **Fix:** `--radius: 0.5rem`. Cards 8px, controls 6px, everywhere.

### D3. Typography noise ⟵ **fixed in this pass**
- Fonts are Manrope + Space Grotesk — off-spec (CLAUDE.md mandates **DM Sans headers + Inter body + JetBrains Mono figures**) and Space Grotesk reads "crypto landing page".
- Uppercase + letter-spacing on nav items, card titles, table headers, labels, badges — everything shouts.
- Sizes jump between `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm` with no scale.
- **Fix:** DM Sans/Inter/JetBrains Mono per spec; sentence case as default; caps reserved for tiny metadata labels only; consistent 12/13/14/16/20 scale.

### D4. Low density ⟵ **fixed in this pass**
- `p-6` cards, `h-10` buttons, `py-3` table cells, 320px hero panels. An importer tracking 40 containers sees ~6 rows per screen.
- **Fix:** compact primitives — h-9 buttons, h-10 table header, py-2.5 cells, p-4/p-5 cards, 56px topnav, 36px nav rows.

### D5. Sidebar looks like a game menu ⟵ **fixed in this pass**
- Gradient active pills with glow shadows, uppercase 12px links, a marketing footer card inside the nav, mesh background.
- **Fix:** flat dark-navy (#16325C family per spec) sidebar, quiet hover, single accent bar + tinted active state, sentence-case labels, compact rows.

### D6. Every page header repeats the company name ⟵ **fixed in this pass**
- `PageHeader` prints "AIMS — Import Management System by Aeden Fruits…" in caps above every title; breadcrumbs in TopNav are raw URL segments (`containers / 3f2a…`).
- **Fix:** PageHeader = title + description + actions, compact. Breadcrumbs map segments to human labels.

### D7. Zero loading feedback ⟵ **fixed in this pass**
- Every page is `force-dynamic` with server fetches and **no `loading.tsx` anywhere** — clicking a nav item freezes the current screen until the DB answers. This alone makes the app feel broken.
- **Fix:** skeleton `loading.tsx` at the dashboard route group level (covers all module pages).

### D8. Remaining design debt ⟵ **swept on 2026-07-08**
- All hardcoded gradient/glow/rounded-[…] instances inside module workspaces replaced with flat primitives; dark heroes (SOP, warehouse SOP) flattened to the navy token; off-token slate chips moved to `bg-muted`.
- `AnalyticsCharts` verified: already uses the brand palette (#0070D2 / #2E844A / #C23934 / #FFB75D / #16325C). No change needed.

---

## 3. Functional gaps

### F1. No pagination on core lists — **high priority**
`lib/data/containers.ts` loads all rows (`findMany` without `take`); documents/payments similar. Fine at 400 rows, dead at 5,000.
**Fill:** cursor pagination in data layer + TanStack Table server-side mode; URL-driven `?page=` like the existing filters.

### F2. No global command palette
An ERP lives on the keyboard. Search is a full page navigation.
**Fill:** `cmdk` palette (Ctrl+K): jump to container/BL, navigate modules, run actions ("New container", "Record payment").

### F3. Notification counts computed on every layout render
`getPersonalNavCounts` runs multiple aggregate queries on **every** navigation of every user.
**Fill:** cache per-user counts (60s `unstable_cache` or a materialized summary), or move badges to client polling of one cheap endpoint.

### F4. No table UX parity with real ERPs
Missing: column show/hide, saved views everywhere (exists only partially), sticky first column, bulk selection on all lists, inline editing where safe, CSV export on every table (only containers has it).
**Fill:** one shared `DataTable` wrapper (TanStack v8 already installed) used by containers/documents/payments/receipts/orders.

### F5. Empty and error states inconsistent
`EmptyState` exists but many pages render bare text or a warning div; only one `error.tsx` for the whole dashboard group; no `not-found.tsx`.
**Fill:** route-level `error.tsx` + `not-found.tsx`, use `EmptyState` with a primary action everywhere.

### F6. Known blocked integrations (from PROGRESS.md, still open)
- Email/OCR document automation (needs provider keys)
- Scheduled report email delivery (blocked on Outlook admin)
- Tally adapter, ICEGATE, carrier event ingestion
- Malware scanning on uploads
**Fill:** these are credential/vendor decisions, not code gaps — decide providers, then wire the existing adapter scaffolding.

### F7. Mobile is an afterthought
Sidebar drawer exists, but dense tables have no card-list fallback; kanban unusable on touch widths.
**Fill:** responsive card renderers for the 3 most-used lists (containers, payments, alerts); accept desktop-only for kanban.

### F8. Repo hygiene / security
- `.env.local.txt` with live secrets is still committed (flagged since Phase 1 — rotate keys, remove file).
- Dev log files (`dev3001.out.log` etc.) committed at root.
- Next is v16, CLAUDE.md says v14 — update the doc or pin the intent.

---

## 4. Prioritized fill plan

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Design system overhaul (D1–D7) | ✅ done (2026-07-08) | Transforms perceived quality |
| 2 | Loading skeletons + error/not-found routes | ✅ done (2026-07-08) | App feels fast & stable |
| 3 | Pagination on containers/documents/payments | ✅ done (2026-07-08) | Survives real data volume |
| 4 | Command palette (Ctrl+K) | ✅ done (2026-07-08) | "Modern ERP" feel, navigation speed |
| 5 | Table upgrades (columns/density/views on containers; export-all on documents & payments) | ✅ done (2026-07-08) | Table parity with Lightning/Odoo |
| 6 | Nav-count caching (60s TTL + invalidation on alert actions) | ✅ done (2026-07-08) | Every click gets faster |
| 7 | Sweep module workspaces onto new primitives | ✅ done (2026-07-08) | Full visual consistency |
| 8 | Secrets rotation + repo cleanup | 0.5 day | Security hygiene |
| 9 | Provider decisions (email/OCR/Tally/ICEGATE) | user decision | Unblocks automation phases |
| 10 | Mobile card fallbacks for top 3 lists | 1–2 days | Field usability |

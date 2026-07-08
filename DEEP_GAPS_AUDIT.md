# AIMS — Deep-Layer Gaps Audit (Part 2, 2026-07-08)

Companion to `ENTERPRISE_READINESS_AUDIT.md` (Part 1: communications, compliance, accounting, observability, testing, module features). This part covers the layer **underneath** those: master data, transactional correctness, scale behavior, deployment reality, and people/process. Every claim below was verified in code unless marked "verify in dashboard."

---

## A. Master data & data lifecycle

### A1. There is NO product/item master — the biggest hidden gap in the system
Verified: the schema has 60+ models but **no Product/Item/Commodity model**. `Container.item`, `StockItem` descriptions, and `packSpec` are free-text strings. Consequences compound silently:
- "Red Globe", "RED GLOBE", "Red-Globe Grapes" become three different items in analytics, price lists, and stock.
- HSN codes (needed for GST in Part 1) have nothing to attach to.
- UoM conversions (box↔kg) have no anchor.
- Supplier performance by commodity, margin by variety, seasonal planning — all unbuildable.

**Solution:** an `items` master (code, name, variety, grade, HSN, default UoM, pack specs as child table) + migration that extracts distinct strings from existing containers/stock into draft items for review, then FK everything (`containers.itemId`, `stock_items.itemId`, price list lines, quote/order lines). Do this **before** the GST work in Part 1 — HSN lives here. This is a 3–5 day job now; at 10k rows it becomes a quarter-long cleanup project.

### A2. No cutover path: opening balances don't exist as a concept
Grep: zero occurrences of "opening" in the schema or lib. When the company goes live, it must load: current stock lots per warehouse, open customer balances (AR), open supplier balances (AP), and in-transit containers. Today the only importer is the container Excel importer.
**Solution:** three guarded importers (opening stock lots, opening AR per customer as synthetic invoices, opening AP per supplier), permitted only while a `FinancePeriodClose` for the go-live month is open, each writing an audited "OPENING" journal/movement. Plus a written cutover checklist (freeze date, physical count, trial balance match).

### A3. Import/export coverage is one-directional and partial
Importers: containers only. No customer, supplier, price-list, or item importers — every master row will be typed by hand.
**Solution:** reuse the ImportWizard pattern (`settings/import`) for customers/suppliers/items/price lists — the mapping infrastructure already exists in `lib/import/mapping.ts`.

### A4. No merge/dedupe for any master
Customer dedupe was flagged in Part 1 for CRM, but the same applies to suppliers (import auto-creates them by name — typos create duplicates, verified in Phase 8 notes) and, once created, items.
**Solution:** a generic merge flow (choose survivor, re-point FKs in a transaction, log to activity) for supplier/customer/item.

### A5. Storage lifecycle is unmanaged
Verified: document DELETE soft-deletes the row and **never touches the Supabase Storage file**. Acceptable for audit retention — but there is no orphan-file report, no storage-usage monitoring, and no retention policy. Files accumulate forever, including files whose upload transaction failed after storage write.
**Solution:** weekly job (queue from Part 1 G8) reconciling storage objects ↔ document rows; flag orphans > 30 days; dashboard tile of storage usage; documented retention rule (e.g., soft-deleted docs purge after 7 years per statutory needs).

## B. Transactional correctness

### B1. No idempotency on mutating APIs
POST /api/payments (etc.) has no idempotency key. UI buttons disable while busy, but a network retry, double-click race, or flaky mobile connection can create duplicate payment requests / receipts / orders.
**Solution:** `Idempotency-Key` header on POSTs from the client (uuid per form submission), unique-indexed `idempotency_keys` table checked in the same transaction. One helper, applied to the ~10 money-touching POST routes.

### B2. No optimistic locking — concurrent edits are last-write-wins
Verified: no `version`/rowVersion fields anywhere; PATCH routes read-then-write without comparing `updatedAt`. Two managers editing the same container's costs simultaneously silently lose one person's work — with no error and no trace.
**Solution:** send `updatedAt` with every edit form; PATCH rejects with 409 ("record changed since you opened it") when it doesn't match the row. Prioritize: container costs, sales, payments, orders. This pairs with the maker-checker culture already in place.

### B3. Money math leaves Decimal at the API boundary
DB stores `Decimal(14,2)` (correct), but every read path converts via `Number()` (`dec()` helpers) and reports aggregate in JS floats. Individual documents are fine; **summed reports can drift by paise** and, worse, comparisons like the ±0.01 journal balance check operate on floats.
**Solution:** aggregate in the database (`_sum`) where possible; where JS math is unavoidable, sum in integer paise. Not urgent-urgent, but fix before the ledger becomes primary (Part 1 G3).

### B4. Timezone: all "today" math runs in server time (UTC), business runs in IST
Verified pattern: `new Date()` / `Date.now()` for due-today, expiring-in-30-days, demurrage day counts. On Vercel (UTC) a payment due "today" flips at 05:30 IST, not midnight; a doc "expires" 5.5 hours late. Every daily boundary in the app is off for an Indian business.
**Solution:** a `lib/dates.ts` with an org timezone (Asia/Kolkata) using date-fns-tz for all day-boundary calculations; sweep `dueAgeDays`, expiry buckets, free-day countdowns, and the report date ranges through it.

## C. Scale & performance behavior

### C1. Analytics loads entire tables into memory
`lib/data/analytics.ts` does `container.findMany` + `payment.findMany` with no `take` and aggregates in JS ("single-pass" per PROGRESS.md). Fine at 500 containers; the dashboard (rendered for every user, every visit) degrades linearly and eventually OOMs the serverless function.
**Solution:** near-term — cache the analytics result per org (same 60s TTL pattern as nav counts, already built). Mid-term — move KPIs to SQL aggregates (Prisma `groupBy`/`aggregate`) and keep only chart series in JS.

### C2. Session profile is fetched from the DB on every request — often twice
`getSessionContext` runs a `prisma.user.findUnique` per call; layout AND page both call it, so each navigation costs 2+ identical lookups (plus Supabase `auth.getUser`).
**Solution:** wrap per-request with React `cache()` (one line) so layout+page share the lookup; optionally a short in-memory TTL like nav counts. Keep the isActive check — it's the kill switch for offboarding and must stay fresh-ish (30s TTL max).

### C3. Unbounded log growth with no retention job
`activity_log` (every mutation) and access logs grow forever; no archive/purge exists. This is also the table most queried by the audit viewer.
**Solution:** monthly partition-or-archive job: move rows older than 24 months to a cold table (or R2 parquet export), keep the viewer querying hot rows. Decide statutory retention with your CA (finance-linked activity likely 8 years in India).

### C4. No realtime — concurrent users see stale boards
The kanban, alerts, and workbench have no live updates; two users drag the same container into different columns and the loser finds out on refresh (the server correctly rejects, but the UX is confusing).
**Solution:** Supabase Realtime subscription on `containers.status`/alert tables for the kanban and alert badge (client-side channel; the infra is already in your stack, unused). Low effort, high perceived quality.

## D. Deployment & platform reality

### D1. You're on Vercel Hobby — this is a production blocker on its own
Evidence: commit "Make Vercel cron Hobby compatible" + single daily cron. Hobby means: **10-second function timeout** (dossier ZIP for a document-heavy container, Excel import of 400+ rows, and management report PDF are all at risk of hard-kill), one cron/day, no SLA, and commercial use is outside Hobby terms.
**Solution:** Vercel Pro before rollout (60s default/300s max timeouts, more crons, SLA) — or move long-running work (ZIP, import, PDF) to the job queue from Part 1 G8 regardless, since even 60s ceilings are gambling.

### D2. No staging environment; migrations go straight to production
Single Supabase project + prod Vercel. Prisma migrations have never been rehearsed against a copy of production data; a bad migration is discovered by the users.
**Solution:** second Supabase project (staging) + Vercel preview env pinned to it; CI step that runs `prisma migrate deploy` against a fresh clone of prod schema (even better: nightly restore of prod backup into staging — which also makes your restore drill continuous, closing Part 1 G5).

### D3. No feature flags or kill switches
Every merge is instantly live for all users. With agents shipping in parallel (your current setup!), one bad module takes the whole ERP down for everyone.
**Solution:** a tiny `feature_flags` table + `isEnabled(flag, role)` helper (no vendor needed) — gate each new module/route; admins see flags in Settings. This is *especially* urgent given multiple agents are landing code simultaneously.

### D4. Supabase default SMTP will throttle your auth emails (verify in dashboard)
Magic links, invites, and password resets go through Supabase's built-in mailer unless custom SMTP is configured — it's rate-limited to a handful of emails/hour and lands in spam. At team rollout, logins will mysteriously fail.
**Solution:** configure custom SMTP (the same Resend/SES account from Part 1 G1) in Supabase Auth settings + set proper SPF/DKIM on your domain.

### D5. CSP allows `unsafe-inline` + `unsafe-eval` in production
Verified in next.config.mjs. This neuters most of the XSS protection the CSP exists for.
**Solution:** drop `unsafe-eval` in production builds (usually only needed in dev); move toward nonce-based script-src (Next.js supports it via middleware). Medium effort, real security payoff.

### D6. No release management surface
No app version anywhere, no changelog, no "what's new", no maintenance-mode banner. When agents ship daily, users can't tell what changed and support can't tell what version a bug report is against.
**Solution:** inject the git SHA at build (`NEXT_PUBLIC_APP_VERSION`), show it in Settings + error reports; a `CHANGELOG.md`-backed "What's new" panel; a `maintenance_mode` flag (uses D3) that shows a banner and blocks writes.

## E. People, process & product hygiene

### E1. User offboarding is half-built
`isActive` exists and is enforced at session lookup (verified — good). Missing: an admin UI to deactivate (team page only changes roles), forced sign-out of live sessions, and **reassignment of owned records** (CRM leads/tasks, alert states, pending approvals owned by the departing user become orphans).
**Solution:** "Deactivate user" flow = confirm → revoke Supabase sessions (admin API) → reassign-owner wizard (pick successor for leads/tasks/approvals) → audit entry.

### E2. No delegation / out-of-office for approvals
Maker-checker is enforced, so when the single approver is on leave, payments and credit notes simply stop.
**Solution:** `approval_delegations` (from-user, to-user, date range, scope) checked by the approval routes; visible banner on the delegate's workbench.

### E3. No training sandbox or demo data
New staff learn on production data — their practice containers and test payments pollute real reports (and the audit log). No seed script exists for a demo org.
**Solution:** a seeded "AIMS Sandbox" script (containers across all stages, docs, payments, stock lots) loadable into staging (D2); onboarding staff train there. The single-tenant `DEFAULT_ORG_ID` assumption (verified in lib/auth.ts) makes an in-prod sandbox org non-trivial — staging is the cheaper path.

### E4. Accessibility was never audited
Enterprise-relevant items visible in code: status communicated by color alone in several badges (margin green/yellow/red — add icons/text, partially done), kanban drag-and-drop keyboard support (dnd-kit ships it but needs announcements config), focus traps in hand-rolled modals, form error announcements. 
**Solution:** one pass with axe DevTools on the 6 core pages; fix color-only signals, labels, and focus order. Doesn't need to be WCAG-certified — needs to not fail basic keyboard use.

### E5. India DPDP Act 2023 exposure (customer/contact PII)
You store customer contacts (names, phones, emails, KYC documents). The DPDP Act applies; nothing exists for consent records, purpose limitation, data-deletion requests, or breach notification duty.
**Solution:** pragmatic minimum — a privacy note, a `data_deletion_requests` log with an admin fulfillment flow (anonymize contact PII, keep financial records per statutory retention), and KYC document access already being signed-URL + logged helps. Get your CA/legal to bless the retention matrix.

### E6. No in-app help or user documentation
The SOP Center documents *business process* (excellent), but nothing documents *how to use AIMS*: no field tooltips on domain-heavy forms (BE No, free days, CHA), no quickstart per role, no support channel link.
**Solution:** lightweight: a `/help` page per module generated from markdown + `?` tooltips on the 20 most domain-specific fields; "Report a problem" link that pre-fills app version (D6) + page.

## F. What to hand the agents next (priority order)

| # | Item | Why first | Size |
|---|---|---|---|
| 1 | Item/product master + backfill (A1) | Everything (GST, UoM, analytics) attaches to it; cost of delay compounds | M |
| 2 | Feature flags + app version (D3, D6) | Safety net for the parallel agent work happening right now | S |
| 3 | Staging env + migration rehearsal (D2) | Same reason — agents are shipping migrations | S |
| 4 | Idempotency keys + optimistic locking on money routes (B1, B2) | Silent data corruption class | M |
| 5 | Timezone sweep to IST day boundaries (B4) | Every daily deadline in the app is currently wrong by 5.5h | S–M |
| 6 | Vercel Pro + long-task queue migration (D1) | Hard timeouts on real workloads | S + M |
| 7 | Supabase custom SMTP (D4) | Team rollout will break logins without it | S |
| 8 | Analytics caching/SQL aggregates + session request-cache (C1, C2) | Dashboard is the most-hit page | S–M |
| 9 | Opening-balance importers + cutover checklist (A2) | Needed before go-live date, long lead time | M |
| 10 | Offboarding + delegation (E1, E2) | Process risk, not code risk — needs product decisions | M |

Items not listed (storage lifecycle, log retention, realtime kanban, a11y pass, DPDP flow, help pages, merge tools) are real but can trail the first wave.

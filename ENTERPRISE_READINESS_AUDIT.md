# AIMS — Enterprise Readiness Audit (2026-07-08)

> Part 2 (deep-layer gaps: master data, transactional correctness, scale, deployment reality, people/process) lives in `DEEP_GAPS_AUDIT.md`.

Full-stack audit: schema (1,977 lines, 60+ models), 56 API routes, 64 lib modules, tests, CI, and ops docs. This is the successor to `GAP_AUDIT_REPORT.md` (UI/UX layer, now closed) and complements `PRODUCTION_HARDENING_CHECKLIST.md`.

---

## 1. Executive summary

The honest headline: **this is much closer to a real ERP than the UI suggested a week ago.** The data model and control logic are genuinely deep — credit exposure checks block order approval, journals refuse to post unbalanced, period close refuses with unmatched bank lines, stock has concurrency-aware reservations with automated expiry, maker-checker covers payments/customers/quotes/orders/cycle counts, and numbering is atomic per document series.

What separates it from a **production-grade, company-wide ERP** is not more screens. It's eight cross-cutting capabilities (§3) and the missing Procurement module (§4.5). Readiness by layer:

| Layer | Score | Blocking items |
|---|---|---|
| Data model | 85/100 | No PurchaseOrder, no FX-rate table, no e-invoice fields |
| Business controls | 80/100 | Journal posting is manual; approval matrix is code, not config |
| UI/UX | 85/100 | Done in previous passes; mobile warehouse floor missing |
| Communications | 10/100 | **Zero email/WhatsApp capability — everything is in-app only** |
| Compliance (India) | 30/100 | No GST invoice print, no e-invoice IRN/QR, no GSTR/e-way bill |
| Observability | 25/100 | console.log-based monitoring; no error alerting, no uptime checks |
| Testing | 35/100 | 39 unit tests + 2 shallow e2e; no DB-backed integration tests in CI |
| Operations/DR | 40/100 | Runbook exists; restore drill never evidenced; secrets still committed |
| Security (authN) | 55/100 | Invite-only + fail-closed roles ✅; no MFA, no session policy |

## 2. What is already enterprise-grade (don't rebuild)

Verified in code, not just claimed:
- **Credit control**: `getCustomerCreditExposure` blocks approval and amendment when exposure > limit; credit hold + KYC + customer approval gates (app/api/sales-orders/[id]/route.ts:175-421).
- **Double-entry integrity**: journals must balance to ±0.01; period close blocked by imbalanced journals or unmatched bank lines (lib/data/finance-controls.ts:288-294).
- **Stock integrity**: DB constraints against negative inventory; `$transaction` in 20 route/lib files; reservation expiry cron with audited release.
- **Governance**: maker-checker across finance objects; reason-controlled cancellations; field-level financial redaction; org-scoped queries + RLS backup; access logging; signed-URL private documents; upload validation; per-route rate limiting (in-memory).
- **Workflow**: stage gates on the container pipeline enforced server-side (409 + reason).
- **CI**: prisma validate → lint → unit tests → build on every push/PR.

## 3. Cross-cutting gaps — the real blockers, with recommended solutions

### G1. No outbound communications (highest impact)
No mailer exists anywhere in the codebase. Alerts die inside the app; a user who doesn't log in sees nothing. An ERP without email is a diary.
**Solution:** Resend (or AWS SES) + React Email templates. One `lib/mailer.ts` + a `notification_outbox` table (write in the same transaction as the event, deliver via cron — the outbox pattern gives you retries and an audit trail). Wire to: alert digests (daily 07:00 IST), payment approval requests, credit-hold events, document expiry, order confirmations to customers. WhatsApp (Interakt/Gupshup on WhatsApp Business API) as phase 2 — in India that's where your team actually lives.

### G2. India compliance (legal blocker for invoicing from the system)
SalesInvoice has tax fields but there is **no GST-compliant printable invoice, no HSN codes, no e-invoice (IRN/QR), no GSTR-1 export, no e-way bill**. Today you cannot legally invoice B2B customers from AIMS if turnover crosses the e-invoice threshold.
**Solution:** (a) add `hsnCode` to invoice lines, `irn`, `ackNo`, `qrCodeData`, `ewayBillNo` to SalesInvoice; (b) GST invoice print route mirroring `/print/container/[id]`; (c) integrate a GSP (ClearTax or Masters India — both have simple REST APIs) for IRN + e-way bill; (d) GSTR-1 XLSX export in the existing Export Center. Alternative if you keep books in Tally: generate invoices in AIMS, post to Tally daily (G3), and let Tally handle statutory filings — smaller build, pick this first.

### G3. Accounting completion — journal automation + Tally
JournalEntry exists but nothing auto-posts: invoices, receipts, credit notes, and payments don't generate journals; the ledger only knows what someone types.
**Solution:** posting rules per document type (invoice → AR/Revenue/GST-output; receipt → Bank/AR; credit note → reverse; supplier payment → AP/Bank), executed inside the same `$transaction` as document approval. Then the **Tally integration** (already scaffolded in `integration_connections`): nightly Tally XML export of day-book vouchers is the pragmatic Indian-SME path — accountants keep Tally, AIMS stays the operational truth.

### G4. Observability
`lib/monitoring.ts` writes to console only. On Vercel, that's logs nobody reads and errors nobody hears about.
**Solution:** Sentry (@sentry/nextjs — free tier is enough) for errors + traces; BetterStack/UptimeRobot on `/api/health` (already exists); Vercel Log Drains → Axiom for retention. Half a day of work, transforms incident response.

### G5. Backup/DR evidence
The runbook documents Backup/Restore SOPs, but the hardening checklist confirms a restore drill has never been executed. An untested backup is a hope, not a backup.
**Solution:** Supabase Pro PITR (7-day) + weekly `pg_dump` to a separate provider (Cloudflare R2) via GitHub Actions cron + storage bucket sync. Then actually run the restore drill and record RPO/RTO in the runbook.

### G6. Test depth
39 unit guardrail tests + 2 e2e specs that only verify login redirects. Credit checks, stock reservations, and journal balancing — your best logic — have no automated regression net against a real database.
**Solution:** (a) integration tests with Vitest + a Postgres service container in CI (CI already provisions `DATABASE_URL`) covering: credit-limit block, reservation expiry, negative-stock rejection, journal imbalance rejection, stage-gate 409s; (b) Playwright flows with a seeded test user: quote→order→dispatch→invoice→receipt, receive→grade→dispatch; run in CI via `npx playwright install --with-deps`. Target ~30 integration + ~8 e2e flows, not coverage %.

### G7. Authentication hardening
Invite-only and fail-closed roles are good. Missing: MFA, session lifetime policy, and eventually SSO.
**Solution:** Supabase Auth MFA (TOTP) — enforce for admin/finance roles at login; short JWT expiry with refresh; add "sign out all sessions" on the team page. SSO (Google Workspace SAML) only when headcount justifies it.

### G8. Platform plumbing
- **Distributed rate limiting**: current limiter is per-instance memory — a Vercel cold start resets it. Move to Upstash Redis (`@upstash/ratelimit`), 1 hour of work.
- **Job queue**: one cron today. Email outbox, OCR jobs, Tally sync, and carrier polling all need scheduled/queued execution → Inngest or Upstash QStash (both Vercel-friendly), with idempotent handlers.
- **FX rates**: `exchange_rate` lives only on container costs, typed by hand. Add a `currency_rates` table + daily cron (exchangerate.host) + rate snapshot on every financial document.
- **Secrets**: `.env.local.txt` still committed — the pending task chip removes it + rotates keys. Do this first.

## 4. Module feature roadmaps

### 4.1 CRM (have: leads, opportunities, tasks, owners, KYC, credit control)
Add, in order:
1. **Activity timeline** — log calls/WhatsApp/emails/meetings per customer & lead (one `crm_activities` table, shows in customer 360). Without this CRM is a list, not a relationship record.
2. **Customer 360** — customers/[id] already strong; embed receivables aging, open orders, disputes, last activities in one view.
3. **Lead lifecycle** — conversion (lead → customer + opportunity) with dedupe check (phone/GSTIN match), merge tool for duplicates.
4. **Follow-up automation** — overdue-task escalation to manager (uses G1 email).
5. **Funnel analytics** — stage conversion %, cycle time, win/loss reasons (add `lostReason`).
6. Later: WhatsApp thread capture, consent/DND register, territory auto-assignment.

### 4.2 Sales (have: quotes + revisions, orders + amendments, price lists, invoices, returns, credit notes, dispatch-linked margin)
1. **GST invoice print + e-invoice** (G2) — the legal unlock.
2. **Partial fulfillment & backorders** — allow shipping less than ordered with a backorder line; today's all-or-nothing dispatch fights perishables reality.
3. **Discount approval matrix** — % thresholds per role (config, not code) with an approvals inbox.
4. **Day-price board** — perishables pricing changes daily; a morning price-set screen (per item/grade/warehouse) that quotes/orders default from, with price-override audit.
5. **Sales targets & commission** — targets per rep/month vs actuals from invoices; simple commission statement export.
6. Later: customer portal (order status + statements), promotions engine.

### 4.3 Warehouse (have: FEFO lots, locations, putaway rules, cycle counts, repacking WOs, QC plans, gate passes, dock appointments, cold-room readings, productivity logs)
1. **Barcode/QR lot labels + scanner PWA** — print QR on GRN (lot id), scan at grading/pick/dispatch. A `/wh` mobile-first route group + `html5-qrcode`. This is the single biggest accuracy win; paper reconciliation is where ERPs die.
2. **Inter-warehouse stock transfers** — transfer-out/transfer-in movement pair with in-transit state (schema has movements; needs the flow + UI).
3. **UoM conversions** — box↔kg per item/pack spec so sales can sell kg from box stock (hardening checklist flags this).
4. **Recall traceability** — lot → customers report (movements already link lots to gate passes; one query + report page).
5. **Temperature telemetry** — replace manual cold-room entries with sensor ingestion (Tive/Sensitech webhook → existing `ColdRoomReading` + breach tasks).
6. Later: wave picking, labor standards from productivity logs.

### 4.4 Finance (have: receipts + allocation, invoices, returns, credit notes, journals, bank statement lines, period close, disputes, AP aging)
1. **Journal automation** (G3).
2. **Bank statement CSV import + auto-match** — model exists; add importer (bank CSV formats for your banks) and match suggestions by amount+date+reference.
3. **Dunning** — AR aging exists; add reminder ladder (7/14/30 days overdue → email templates, G1) with a "promise to pay" note field.
4. **FX table + revaluation** (G8) — month-end unrealized gain/loss journal on open USD/AED AP.
5. **Approval matrix config** — thresholds for credit notes/payments/discounts in an admin screen instead of code.
6. Later: TDS tracking, cost centers, cash-flow forecast (payables due + receivables promised).

### 4.5 Procurement — the missing module (nothing exists beyond supplier master + claims)
Minimum viable for an import business:
1. **Purchase Order** model + lifecycle (Draft → Approved → Shipped → Linked-to-Container → Closed) — the container becomes the receipt against a PO, closing the loop between commitment and landed cost.
2. **Estimated vs actual landed cost** per PO/container — you already compute actuals; add the estimate at PO time and show variance (this is the profit-leak detector).
3. **Supplier scorecards** — on-time %, quality claims (SupplierClaim exists), landed-cost variance, margin by supplier (analytics already has margin by supplier).
4. **Advance payment linkage** — payments already exist; link them to POs so exposure per supplier is visible before shipment.
5. Later: seasonal contracts, supplier quote comparison.

### 4.6 Import/Logistics (have: full container lifecycle, demurrage watch, arrival workflow, dossier ZIP)
1. **Carrier tracking ingestion** — poll a container-tracking API to auto-update vessel/ETA/ATA instead of manual entry.
2. **ICEGATE BE status** — via a customs-data provider; auto-advance Customs Clearance stage.
3. **Demurrage forecaster** — you have free-day countdowns; add projected charge amounts (per-line tariff table) to turn alerts into rupee decisions.

### 4.7 Platform/Admin
1. Approval matrix + numbering series + alert-routing as **config screens** (all currently code).
2. **Custom roles** — role → capability mapping in DB (permissions.ts already centralizes capabilities; move the matrix to a table with cache).
3. Data lifecycle: retention policy for activity/access logs; scheduled archive.
4. i18n scaffold only if you'll hire non-English operators; else skip.

## 5. Recommended sequence (90 days)

**Phase A — Trust (weeks 1–2):** secrets rotation (chip), Sentry + uptime + log drain (G4), restore drill (G5), Upstash rate limiting (G8), MFA for admin/finance (G7).
**Phase B — Reach (weeks 3–5):** email outbox + templates (G1), dunning ladder, alert digests; integration tests + Playwright flows in CI (G6).
**Phase C — Legality (weeks 6–9):** GST print + e-invoice fields, Tally day-book export (G2/G3), journal automation, bank import.
**Phase D — Floor & loop (weeks 10–13):** barcode PWA + transfers + UoM (warehouse), Purchase Orders + landed-cost variance (procurement), day-price board (sales).

Everything in A–B is small, high-leverage, and independent. C makes the finance module legally usable. D is where the operational moat gets built.

## 6. Decisions needed from you (blockers I can't decide)

1. **Books of record**: Tally stays (build export) or AIMS becomes primary ledger (build GSP e-invoicing + GSTR)? Recommendation: Tally stays, for now.
2. **Email provider**: Resend (fastest) vs SES (cheapest at volume) — and the sending domain.
3. **WhatsApp BSP** (phase 2): Interakt / Gupshup / none yet.
4. **Error monitoring**: Sentry OK? (free tier, EU/US data residency choice).
5. **OCR/email-ingest providers** for document automation (long-pending from Phase 22).
6. **Container tracking data source** (e.g., a tracking API subscription) — needed for 4.6.

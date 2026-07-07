# Aeden International Management System ERP Master Roadmap

Status: Phase 1 build starting

This roadmap is the company-level delivery map for the ERP expansion of Aeden Fruits International Pvt Ltd.
It is written for operations, finance, warehouse, sales, and integration ownership.

Build rule:
- no phase starts before the current phase has a working contract, audit trail, and exit gate
- no sensitive finance data is exposed to roles that should not see it
- no third-party sync is allowed to overwrite internal truth without traceable references
- no pilot rollout expands beyond one warehouse lane until the first lane is stable

---

## Phase 1 - Foundation and Contracts

Goal:
- lock the ERP operating model, roles, permissions, and audit standard before any wider build.

Scope:
- final role map and permission matrix
- field-level visibility by role
- audit log standard and reason-trail policy
- single-org pilot boundary
- finance redaction rules
- external reference contract for future integrations

Deliverables:
- canonical role and capability matrix
- customer, sales, warehouse, and finance visibility rules
- mandatory reason trail on high-risk overrides
- audit-log entries for approvals and reversals
- stable pilot scope for one warehouse and one sales lane

Exit gate:
- no financial leakage in non-financial views
- no approval/override without a reason trail
- old and new role mappings are stable
- the phase 2 warehouse build can start without contract churn

---

## Phase 2 - Warehouse Master and Cold-Storage Control

Goal:
- make the warehouse the operational heart of the ERP.

Scope:
- warehouse master data
- container-to-warehouse assignment
- inbound acceptance gates
- storage zone / cold room tracking
- stock lot traceability
- warehouse admin screens
- room, zone, and bin/location hierarchy for cold storage
- temperature class by room or zone
- quarantine, hold, and release states
- staging yard, dock, and dispatch bay visibility
- lot ageing, ripening, and conditioning states where relevant
- cycle count and physical count support
- temperature-breach and damage exception records

Exit gate:
- cleared containers can enter only through a named warehouse
- warehouse assignments are searchable and auditable
- stock can be seen at room, zone, and lot level
- blocked or quarantined stock cannot be sold by mistake
- pilot warehouse can operate with FEFO and room occupancy intact

---

## Phase 3 - Stock Receiving, Grading, and Movement Ledger

Goal:
- convert incoming containers into sellable lots with clean inventory math.

Scope:
- receive
- grade
- split
- wastage / dump
- reserve / release
- FEFO-led availability
- movement history
- lot-level stock creation after receiving
- grade conversion by SKU, condition, and marketable quality
- box / kg first, then pallet / punnet / container as needed
- regrade, repack, and transfer between grades
- shrinkage, wastage, breakage, and spoilage reason codes
- quarantine release and hold reversal
- physical-count adjustments with approvals
- stock ageing by arrival and condition date

Exit gate:
- stock balances always reconcile to movements
- perishability, ageing, and quantity integrity remain intact
- FEFO allocation works per warehouse and per lot
- a dispatcher can see sellable vs blocked stock clearly
- no manual adjustment can bypass audit trail and reason code

---

## Phase 4 - CRM, Credit Control, and Customer Risk

Goal:
- make customer onboarding and credit control safe enough for live sales.

Scope:
- customer master
- contacts
- KYC documents
- GSTIN / PAN validation
- credit limit
- credit hold
- risk summary
- hold override trail
- customer tier / segment
- bill-to / ship-to / branch mapping
- assigned sales rep and regional ownership
- duplicate customer detection and merge review
- payment terms, overdue banding, and credit review cadence
- KYC review status, reviewer, and review timestamp
- customer activity timeline
- override approval reason and audit trail
- customer import / migration support from old tracker data

Exit gate:
- sales cannot bypass credit rules
- risk states and override reasons are visible in audit form
- a customer cannot go live without mandatory tax and credit fields
- duplicate or conflicting customer records are flagged before use
- overdue risk is visible before an order can be approved

---

## Phase 5 - Pricing, Orders, and Approval Routing

Goal:
- let sales work from published day prices with tight floor-price control.

Scope:
- day price desk
- published / unpublished states
- order default pricing
- custom pricing approval
- floor-price redaction
- reservation and release on order lifecycle changes
- price matrix by warehouse, item, grade, UoM, and customer tier
- effective date and price snapshot locking
- approval routing by delta, margin, and role
- order amendment history
- short supply, substitution, and partial allocation handling
- order hold / credit hold integration
- price-row traceability for every order line
- sales order import from legacy sources where needed

Exit gate:
- published day price exists per warehouse/date
- orders cannot proceed without the active price contract
- order lines can be traced back to the exact price row used
- sales cannot override pricing without an audit-visible reason
- no order can bypass customer credit or hold checks

---

## Phase 6 - Fulfilment, Dispatch, Receipts, and Ledger

Goal:
- run picking, packing, gate pass, dispatch, and receivables as one flow.

Scope:
- fulfilment board
- gate passes
- partial dispatch
- customer receipts
- receivable ageing
- collections view
- pick / pack / ready / gate-pass / dispatched state machine
- dispatch shortfall and backorder handling
- return, rejection, and damage capture
- invoice-ready status after dispatch
- dispatch-to-lot traceability
- receipt allocation against order and customer ledger
- cash / cheque / transfer / UPI receipt methods if used
- credit note or adjustment workflow if required by finance

Exit gate:
- dispatched stock matches sales truth
- receipts reconcile to customer ledger
- dispatch and receipt states are fully auditable
- partial dispatch does not break order balance or inventory balance
- finance can close the day without manual guesswork

---

## Phase 7 - Integration Hub and Migration Layer

Goal:
- connect third-party WMS, ERP, email, OCR, courier, and banking sources.

Scope:
- provider registry
- connection settings
- external references
- sync runs and errors
- retry / exception queue
- import templates and history loads

Exit gate:
- external records remain traceable to source systems
- mismatches can be seen, corrected, and replayed

---

## Phase 8 - Reporting, Finance Close, and Hardening

Goal:
- make leadership reporting, finance controls, and rollout safe for company use.

Scope:
- margin and profitability views
- ageing and collections
- stock ageing
- audit viewer
- test coverage
- rollout checklist
- customer risk dashboard
- warehouse occupancy and ageing dashboard
- lot-level margin analysis
- override and exception reporting
- reconciliation against legacy / external systems
- finance close support for receipts, ageing, and approvals
- pilot expansion checklist by city, warehouse, and sales team

Exit gate:
- finance numbers are repeatable
- operations can support the pilot without ad hoc fixes
- leadership can read the business without requesting raw spreadsheets
- audit, finance, sales, and warehouse all agree on the same operating numbers

---

## Ownership Lens

- CEO view: the ERP must become the operating system of the company, not a side tracker.
- COO view: the ERP must enforce SOPs, not just display them.
- CFO view: the ERP must protect margins, credits, receivables, and approvals.

---

## Aeden ERP Hardening Assessment

### CRM assessment
The current CRM direction is good, but it is not yet a full ERP CRM.

What is present:
- customer master
- contacts
- KYC documents
- credit hold
- risk summary
- hold override trail

What is still weak:
- no formal customer lifecycle from prospect to approved-to-trade
- no customer hierarchy for bill-to, ship-to, or branch accounts
- no review cadence for limits and overdue exposure
- no duplicate merge workflow for imported customer lists
- no mandatory override reason chain for all credit exceptions
- no hard tie between customer risk and order approval gates

What Aeden needs:
- tax-valid customer onboarding
- risk bands tied to overdue exposure and utilisation
- region-scoped ownership for sales teams
- approval queue for KYC and credit changes
- importer-friendly customer migration from legacy sheets
- an activity timeline like top CRMs
- lead/opportunity style pipeline tracking for prospect-to-customer conversion
- task, reminder, and follow-up discipline for reps
- customer segmentation and account ownership like enterprise CRMs
- quote, order, and credit interplay in one customer record

### Sales assessment
The sales module is on the right path, but it still needs ERP-grade controls.

What is present:
- day-price driven order entry
- custom price and discount support
- stock reservation
- approval routing
- order-to-fulfilment flow

What is still weak:
- no full amendment lifecycle
- no backorder or short-supply policy
- no substitute item policy
- no price snapshot locking in every line
- no guaranteed lock between price approval and order confirmation
- no strict link between credit state and order execution

What Aeden needs:
- exact matched price row traceability
- approval thresholds by margin and role
- partial dispatch and invoice balance control
- order revision history
- forced reason trails for overrides and exceptions
- quote-to-order flow
- pipeline visibility from lead to order to collection
- forecasting and target tracking for managers
- rep productivity views similar to market-leading sales hubs
- one place for activities, notes, quotes, and customer history

### Warehouse assessment
The warehouse module is useful, but cold-storage ERP needs more than stock boards.

What is present:
- warehouse assignment
- inbound gate
- stock receiving
- FEFO-led dispatch support
- fulfilment board

What is still weak:
- no full room / zone / bin model in the operating plan
- no quarantine and hold discipline at lot level
- no temperature-breach exception workflow
- no explicit ripening, conditioning, or regrade control
- no physical count / cycle count reconciliation built into the operating cycle

What Aeden needs:
- room-level occupancy and lot placement
- lot ageing by fruit condition and storage date
- damage, shrinkage, dump, and regrade reason codes
- stock visibility by warehouse, room, lot, and status
- dispatch staging that respects cold-chain handling
- directed putaway and pick-lane logic like enterprise WMS products
- replenishment and cycle-count workflows
- barcode or scan-ready operating model for floor teams
- task-driven receiving, picking, and dispatch queues
- exception handling for holds, damages, and temperature breaches

### CFO assessment
The finance controls are directionally correct, but they must be hardened before wide rollout.

What is present:
- cost redaction
- floor-price control
- receivables and ageing direction
- override trails

What is still weak:
- no fully defined approval matrix for pricing and credit exceptions
- no explicit cash allocation or receipt matching policy
- no formal write-off / credit note / dispute workflow in the current roadmap
- no clear month-end close pack or reconciliation cadence

What Aeden needs:
- margin visibility by lot, warehouse, and customer
- receivable ageing by bucket and risk tier
- clear receipt allocation rules
- approval paths for exceptions, discounts, and write-offs

### COO assessment
Operationally, the biggest gap is SOP enforcement.

What is present:
- process direction exists
- dispatch and fulfilment are scoped
- warehouse and sales are connected in roadmap form

What is still weak:
- no enforced cold-chain SOP state model
- no operational exception queue
- no count-check-recount discipline
- no handling policy for damaged, shrivelled, or rejected fruit
- no readiness gate for expansion beyond the pilot warehouse

What Aeden needs:
- a real operating calendar for receive, grade, move, dispatch, count, and review
- exception management instead of silent correction
- audit-first actions for every material change

---

## Market Benchmark Summary

This is the comparison standard we should treat as the bar.

### What top-tier CRMs usually have
- account and contact management
- lead and opportunity pipeline
- activity timeline with calls, emails, meetings, notes
- task assignment and reminders
- quotes and approvals
- forecasting and target tracking
- segmentation, territory, and ownership rules
- automation and alerts
- reporting and dashboards
- mobile-friendly rep workflows

### What top-tier sales hubs usually have
- lead-to-deal flow
- quote generation
- playbooks and guided selling
- email engagement and task sequencing
- manager forecasting and pipeline visibility
- collaboration on deals
- role-based dashboards

### What top-tier WMS products usually have
- warehouse and location hierarchy
- directed putaway and picking
- lot, serial, and expiry tracking
- FEFO/FIFO support
- cycle counts and stock adjustments
- wave/zone/task management
- mobile or scan-led operations
- exception queues
- replenishment and staging controls
- audit trails by stock movement and user

### How AIMS should differ
AIMS should not copy a generic CRM or WMS blindly.
It should become a fruit-import ERP with:
- stronger lot ageing and FEFO than generic CRMs
- stronger cold-storage handling than generic sales systems
- stronger credit and margin control than generic warehouse software
- a direct bridge from customer risk to order approval to fulfilment to receivables
- built-in support for imported fruit realities like grading, conditioning, spoilage, shrinkage, and partial dispatch

---

## Current Build Status

- Phase 1 is the current build target.
- The immediate next code work is foundation-level control: enforced hold reasons, role contracts, and audit-visible overrides.
- Phase 2 and beyond should not accelerate until Phase 1 is stable in the live app.

# AIMS - Sprint-by-Sprint Execution Plan

Status: Draft for delivery planning

This plan turns the tightened ERP route into a practical sprint schedule.
Assumption:
- 2-week sprints
- one product squad
- one backend/DB owner
- one frontend owner
- one QA/release owner
- one domain reviewer from the business side

Delivery rule:
- do not start the next sprint until the current sprint passes its exit gate
- do not build future-module screens before the shared data contract exists
- do not widen pilot scope until the first warehouse lane is stable
- do not push to `main` during active development; keep work on feature branches until the agreed module set is complete and validated

---

## Aeden ERP Execution Board

This is the current build board for Aeden Fruits International Pvt Ltd.
It is ordered to keep the company safe while still moving fast enough to become a full ERP.

| Sprint | Build focus | Business outcome | Exit gate |
| --- | --- | --- | --- |
| 0 | Control plane | roles, redaction, audit, pilot boundary | no sensitive leakage and no unstable permissions |
| 1 | Warehouse master | warehouse assignment and cold-room backbone | cleared containers land only in named warehouses |
| 2 | Receiving + grading | sellable lots with movement truth | balances reconcile and FEFO is usable |
| 3 | CRM + credit | controlled onboarding and customer risk | no customer goes live without tax and credit discipline |
| 4 | Daily pricing | publish day prices with floor control | price exists before sales can trade |
| 5 | Sales orders | default price, overrides, approval routing | orders reserve stock and keep audit trails |
| 6 | Fulfilment | pick, pack, ready, gate pass, dispatch | dispatch matches stock and sales truth |
| 7 | Receipts | collections and receivables control | payment posting and ageing match reality |
| 8 | Reporting | leadership and finance views | reports are role-safe and repeatable |
| 9 | Migration + integrations | old data and third-party sync | imports and syncs are traceable, not silent |
| 10 | Hardening + pilot | smoke tests and controlled rollout | one warehouse lane can run without babysitting |

Sprint guardrails:
- CRM must never expose customer duplicates or unreviewed risk states to sales execution.
- Sales must never bypass published price, credit hold, or approval rules.
- Warehouse must never receive or dispatch stock without lot lineage, cold-chain state, and audit trail.
- Finance must always be able to reconstruct what happened from the ledger and audit log.

---

## Sprint 0 - Contracts and Control Plane

### Objective
Lock the ERP operating model before adding new workflow tables.

### Scope
- finalize role migration map
- define capability matrix
- define field-level visibility
- define audit log standard
- decide pilot scope:
  - one city
  - one warehouse
  - one sales team
- add only the smallest Prisma pieces needed for permissions and audit

### Deliverables
- role mapping document
- capability matrix in code
- server-side redaction rules
- audit log baseline
- pilot decision note

### Dependencies
- current auth structure
- current team/org model

### Exit gate
- no field-level financial leakage in non-financial payloads
- old and new roles map cleanly
- pilot boundary is locked

### Risks
- over-expanding the model too early
- mixing UI hiding with true access control

---

## Sprint 1 - Warehouse Master

### Objective
Create the warehouse backbone and make warehouse assignment mandatory before inbound stock.

### Scope
- add `Warehouse`
- add warehouse assignment fields to `Container`
- enforce `InWarehouse` gate
- build warehouse CRUD
- build assignment UI on container detail
- build inbound queue for cleared containers
- include cold-storage attributes and temperature-zone setup

### Deliverables
- warehouse table and API
- warehouse admin screen
- container assignment flow
- inbound validation rule

### Dependencies
- Sprint 0 permissions

### Exit gate
- a cleared container can be assigned to a warehouse
- a container cannot enter stock without warehouse assignment
- warehouse codes are unique
- cold-room or storage-zone setup exists for the pilot warehouse

### Risks
- inconsistent container state
- assignment happening after inbound without trace

---

## Sprint 2 - Stock Receiving and Grading

### Objective
Convert inbound containers into auditable sellable stock.

### Scope
- add `StockItem`
- add `StockMovement`
- build receive flow
- build grade/sort flow
- build wastage and dump flow
- add reserve/release logic
- add live stock list with ageing
- support `box` and `kg` first
- add FEFO allocation and quarantine handling for temperature-breached lots
- add optional conditioning or ripening status for fruit categories that require it

### Deliverables
- receive-and-grade workflow
- stock movement ledger
- live stock dashboard
- reserve/release controls

### Dependencies
- Sprint 1 warehouse assignment

### Exit gate
- container can be received into warehouse stock
- stock math stays correct after every movement
- live stock and ageing are visible
- cold-chain exceptions are visible and actionable
- conditioning or ripening states can be tracked when needed

### Risks
- quantity drift between movement and balance
- vague UoM conversions
- ignoring perishability or room-temperature exposure

---

## Sprint 3 - CRM and Customer Control

### Objective
Make customer onboarding controlled, compliant, and credit-aware.

### Scope
- add `Customer`
- add `CustomerContact`
- add `CustomerKycDocument`
- validate GSTIN and PAN
- add KYC approval workflow
- add credit limit and credit hold
- add assigned rep
- add region scoping for sales executives

### Deliverables
- customer master screens
- KYC upload and approval queue
- validation rules
- credit hold controls
- regional access control

### Dependencies
- Sprint 0 role model

### Exit gate
- sales rep can onboard a customer
- KYC and mandatory IDs are enforced
- regional isolation works

### Risks
- incomplete validation
- region leaks through search and lists

---

## Sprint 4 - Daily Pricing

### Objective
Launch the HQ price desk with strict publish control.

### Scope
- add `PriceList`
- add `PriceListItem`
- build day-price desk
- support publish/unpublish
- add benchmark price field
- enforce silent floor server-side
- redact floor/cost/margin from non-financial views

### Deliverables
- pricing admin screen
- published price list flow
- pricing API with visibility rules
- price history

### Dependencies
- Sprint 0 financial visibility rules
- Sprint 3 customer tier structure

### Exit gate
- a published day price exists per warehouse/date
- orders cannot proceed without it
- floor logic never reaches sales or warehouse payloads

### Risks
- cost leakage through API responses
- pricing changes without audit

---

## Sprint 5 - Sales Order Creation

### Objective
Let sales create orders with default pricing, custom pricing, and approvals.

### Scope
- add `SalesOrder`
- add `SalesOrderLine`
- default lines to day price
- support custom price and discount
- soft reserve stock on submit
- release reserve on rejection/cancel
- route approvals by role and price delta
- block confirmation if no published price exists

### Deliverables
- sales order create/edit flow
- approval queue
- reserve/release stock logic
- order state transitions

### Dependencies
- Sprint 2 stock availability
- Sprint 4 pricing

### Exit gate
- order can be created and priced
- stock reserves correctly
- approval routing works
- no cost visibility for sales roles

### Risks
- stale stock reservation
- approval rules becoming inconsistent

---

## Sprint 6 - Fulfilment and Dispatch

### Objective
Close the loop from approved order to dispatched stock.

### Scope
- add `GatePass`
- build fulfilment board:
  - Pick
  - Pack
  - Ready
  - Gate Pass
  - Dispatched
- support partial dispatch
- roll dispatch into sold quantities
- update container sold status

### Deliverables
- fulfilment board
- dispatch flow
- gate pass generator
- container-to-order traceability

### Dependencies
- Sprint 5 approved orders

### Exit gate
- approved order can be fulfilled end to end
- partial dispatch works
- inventory and container states remain consistent

### Risks
- partial dispatch edge cases
- status roll-up errors

---

## Sprint 7 - Receipts and Customer Ledger

### Objective
Turn orders into receivables and visible collections.

### Scope
- add `CustomerReceipt`
- post money against orders
- compute outstanding balance
- compute ageing
- show order-level collection history
- add customer ledger view

### Deliverables
- receipt entry screen
- receivables dashboard
- customer ageing view
- collections history

### Dependencies
- Sprint 5 order totals
- Sprint 6 dispatch flow

### Exit gate
- receipts post correctly
- outstanding balance is correct
- ageing is visible and audit-safe

### Risks
- duplicate receipt posting
- partial collection handling errors

---

## Sprint 8 - Reporting and Visibility

### Objective
Give leadership and operations the right dashboards without breaking role safety.

### Scope
- sales analytics
- stock dashboards
- customer purchase history
- ageing views
- margin views for financial roles only
- printable order/invoice output
- printable gate pass output

### Deliverables
- analytics pages
- printable outputs
- role-safe reporting layer

### Dependencies
- Sprint 2 stock
- Sprint 5 orders
- Sprint 7 receipts

### Exit gate
- leadership sees the numbers
- sales sees operations only
- finance sees margin and collections

### Risks
- report leakage of restricted values
- inconsistent derived metrics

---

## Sprint 9 - Migration and Third-Party Integration

### Objective
Make AIMS able to absorb old data and sync with warehouse or ERP systems.

### Scope
- import preview
- column mapping
- duplicate detection
- staged commit
- import error report
- external reference model
- sync runs and sync logs
- exception queue
- retry handling

### Deliverables
- import workflow
- migration templates
- integration registry
- sync/error audit trail

### Dependencies
- stable core entities from Sprints 1 to 8

### Exit gate
- previous tracker data can be loaded safely
- third-party sync is traceable
- mismatches create exceptions, not silent overwrites

### Risks
- data corruption from weak mapping
- sync logic becoming hard-coded per provider

---

## Sprint 10 - Hardening and Pilot Rollout

### Objective
Stabilize the platform for a controlled pilot release.

### Scope
- workflow smoke tests
- seed roles, warehouse, customer tiers, and price lists
- audit every mutation
- add observability and error review
- run one warehouse, one city, one sales team pilot
- validate cold-room occupancy, quarantine, and FEFO behavior during pilot

### Deliverables
- automated smoke suite
- seed data set
- release checklist
- pilot readiness review

### Dependencies
- completion of core workflows

### Exit gate
- pilot can run without engineer babysitting
- core workflows pass smoke tests
- audit log covers all key mutations
- rollout can expand city-by-city

### Risks
- unresolved edge cases from integration
- production-only data issues

---

## Recommended Delivery Sequence

If the team needs the safest order, use this priority:
1. Sprint 0
2. Sprint 1
3. Sprint 2
4. Sprint 3
5. Sprint 4
6. Sprint 5
7. Sprint 6
8. Sprint 7
9. Sprint 8
10. Sprint 9
11. Sprint 10

## Rollout Rule

Do not expand beyond the pilot lane until:
- warehouse receiving is stable
- stock math is stable
- pricing publish works
- order approval is stable
- dispatch is stable
- receipts are stable
- audit is stable

## Git Rule

- `main` stays untouched while modules are in progress
- each sprint or module should live on a feature branch
- merge to `main` only after the selected module set passes QA, review, and release approval
- if a partial module is incomplete, keep it isolated rather than landing an unsafe half-finished state

## What To Avoid

- building sales screens before pricing and permissions
- building reporting before ledger logic exists
- wiring WMS sync before the internal contract is stable
- letting UI hide sensitive values while APIs still leak them
- widening the pilot before one warehouse proves the flow

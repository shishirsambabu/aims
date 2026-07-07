# AIMS — Warehouse, Sales, Import Migration & Integration Master Plan

Status: Draft for approval

This document rewrites the warehouse + sales expansion into an operating SOP, not just a feature checklist. It covers:
- legacy data onboarding
- warehouse operations
- sales and pricing
- third-party integration
- reconciliation and controls
- phased implementation with exit criteria

The goal is to make AIMS able to:
- import prior tracker data safely
- run alongside a third-party WMS / ERP / accounting stack
- keep stock, orders, receipts, and documents consistent
- expose the right data to the right roles
- support a controlled rollout without disrupting live operations

---

## 1. Operating Principles

1. Source of truth must be explicit.
   - AIMS is the operational system of record for import workflow, stock visibility, sales workflow, approvals, and audit history.
   - Third-party systems may be source systems for inbound events or downstream finance, but every synced record must land in AIMS with a traceable external reference.

2. Every external record must be linkable.
   - Each imported or synced entity must store provider, external ID, sync status, and last sync metadata.
   - No silent duplicates. Conflicts must go to an exception queue.

3. Historical migration and live sync are different workflows.
   - Historical import is a one-time or staged load.
   - Integration sync is ongoing and incremental.
   - They must not share unsafe shortcuts.

4. Business rules must stay server-side.
   - Cost floor, pricing approval, stock reservation, credit checks, region walls, and role redaction must all be enforced in APIs.
   - UI can assist, but the server must decide.

5. Reconciliation is a first-class workflow.
   - If AIMS and a third-party system disagree, the mismatch must be visible, explainable, and resolvable.
   - Reconciliation should never mutate data silently.

6. Auditability is non-negotiable.
   - Every import, sync, approval, adjustment, and override must be written to an audit trail.
   - Human changes and automated changes must be distinguishable.

---

## 2. Full Operating Scope

### 2.1 Legacy data onboarding

The system must be able to import existing business records from Excel, CSV, or structured exports from other systems.

Required import groups:
- containers
- suppliers
- customers
- warehouse masters
- stock snapshots
- sales orders
- invoices
- payments and receipts
- documents and document metadata
- historical price lists
- historical stock movements

Import requirements:
- dry-run preview before commit
- column mapping
- duplicate detection
- validation rules
- source row traceability
- error report export
- staged commit where needed
- post-import reconciliation summary

Import outcomes:
- rows imported successfully
- rows skipped as duplicates
- rows rejected due to validation
- rows requiring manual review
- rows linked to existing AIMS records

### 2.2 Warehouse operations

AIMS must manage warehouse-linked stock from intake to dispatch.

Required warehouse functions:
- assign a container to a warehouse
- receive stock into warehouse
- grade or sort stock into sellable SKUs
- track quantity by unit of measure
- track wastage, shrinkage, and dump
- reserve stock for pending orders
- release stock when orders are rejected or cancelled
- fulfil stock through picking, packing, gate pass, and dispatch
- support partial dispatch
- record adjustments with reason codes

### 2.3 Sales and customer operations

AIMS must support end-to-end customer handling and sales execution.

Required sales functions:
- customer onboarding
- KYC capture and review
- credit limit and credit hold management
- customer tier assignment
- order creation
- day-price defaulting
- custom price request and approval
- order status tracking
- receipt capture
- ageing and collections visibility

### 2.4 Pricing and approvals

Day pricing must be centrally published and warehouse-aware.

Required pricing functions:
- daily price setup by warehouse, tier, SKU, grade, and UoM
- publish/unpublish workflow
- benchmark price capture
- price history
- role-based visibility
- approval routing for custom prices
- silent floor enforcement server-side

### 2.5 Third-party integrations

AIMS must integrate with external systems without hard-coding each provider into business pages.

Required integration functions:
- provider registry
- connection setup
- credential references
- test connection
- sync now
- scheduled sync
- sync logs
- error tracking
- retry handling
- external ID mapping
- dry-run preview for mutations

Integration targets can include:
- warehouse management systems
- ERP / accounting systems
- email providers
- OCR / document extraction providers
- courier / carrier systems
- banking or payment feeds

### 2.6 Reconciliation and controls

The platform must surface mismatches, not hide them.

Required reconciliation functions:
- stock reconciliation
- order reconciliation
- receipt reconciliation
- document reconciliation
- external ID reconciliation
- exception queue
- manual override with audit trail
- correction workflow with approvals

---

## 3. Data Model Strategy

The data model should expand in controlled layers, with every new operational entity carrying:
- `org_id`
- `created_at`
- `updated_at`
- soft-delete where mutable
- external reference fields where synced
- audit linkage for state-changing operations

### 3.1 New domain groups

#### Warehouse domain
- `Warehouse`
- `StockItem`
- `StockMovement`
- optional `WarehouseTransfer`

#### Pricing domain
- `PriceList`
- `PriceListItem`
- optional `PriceOverrideRequest`

#### CRM domain
- `Customer`
- `CustomerContact`
- `CustomerKycDocument`

#### Sales domain
- `SalesOrder`
- `SalesOrderLine`
- `GatePass`
- `CustomerReceipt`
- optional `SalesReturn`

#### Integration domain
- `IntegrationConnection`
- `IntegrationRun`
- `IntegrationError`
- `ExternalReference`
- optional `SyncCheckpoint`
- optional `ImportJob`

#### Migration domain
- `ImportBatch`
- `ImportBatchRow`
- `ImportMappingTemplate`
- `ImportValidationIssue`

### 3.2 Required reference fields

Every entity that can be synced or imported should store:
- `sourceSystem`
- `externalId`
- `externalStatus`
- `lastSyncedAt`
- `syncHash` or checksum where useful

### 3.3 History and lineage

For business trust, the model should preserve:
- what was imported
- from where it came
- who approved it
- when it changed
- what it changed into

This is especially important for:
- stock adjustments
- order approvals
- price overrides
- customer KYC review
- receipts
- reconciliation corrections

---

## 4. Process SOP

### 4.1 Historical onboarding SOP

1. Prepare source files.
   - Export historical data from the old tracker, WMS, ERP, or manual spreadsheets.
   - Normalize headers where possible.

2. Choose an import template.
   - Match source columns to AIMS fields.
   - Save the mapping so future imports can be repeated consistently.

3. Run a dry preview.
   - Validate required fields.
   - Detect duplicates.
   - Detect invalid references.
   - Flag missing or ambiguous values.

4. Review exceptions.
   - Resolve duplicates.
   - Decide whether a row should create a new record or attach to an existing one.
   - Correct bad source values before commit.

5. Commit in batches.
   - Import in controlled batches to avoid partial failure.
   - Write every action to an import log.

6. Reconcile after import.
   - Compare counts, totals, and key identifiers.
   - Confirm that linked documents, stock, and payments are consistent.

### 4.2 Warehouse receiving SOP

1. Container is cleared and assigned to a warehouse.
2. Warehouse team receives the container into stock.
3. Stock is graded or sorted into sellable units.
4. Wastage, shrinkage, and dump are recorded.
5. Available stock is visible for sales.
6. Any external WMS updates are synced back into AIMS.

### 4.3 Sales order SOP

1. Sales rep selects customer and warehouse scope.
2. System defaults to published day price.
3. Rep may request a custom price or discount.
4. Server checks floor, credit, and stock rules.
5. Order routes for approval when needed.
6. Approved order reserves stock.
7. Warehouse fulfils the order.
8. Dispatch updates stock and container sales roll-up.
9. Receipt is recorded against the order or customer ledger.

### 4.4 Third-party sync SOP

1. External event or scheduled sync enters the integration layer.
2. Record is validated and mapped.
3. If the record matches an existing external reference, update the linked AIMS entity.
4. If it is new, create it only if validation passes.
5. If there is ambiguity, send the item to an exception queue.
6. Every sync attempt writes a run record and error record if needed.

### 4.5 Reconciliation SOP

1. Compare AIMS totals with the third-party system.
2. Flag mismatches by category:
   - stock count
   - order count
   - dispatch status
   - receipt amount
   - document state
3. Investigate the source of truth.
4. Apply correction only with approval and audit trail.
5. Re-run reconciliation after correction.

---

## 5. Role and Visibility Model

The role model should be expanded carefully so the new functions are usable without exposing sensitive financial data.

Recommended operational roles:
- `sales_executive`
- `sales_manager`
- `gm`
- `warehouse`

Existing roles should remain valid:
- `admin`
- `manager`
- `clearing_agent`
- `finance`
- `viewer`
- `auditor`

Recommended visibility rules:
- sales executives: customer, stock availability, published price, their own orders, no cost floor
- sales managers: approvals, customer limits, region oversight, no cost floor
- warehouse: stock movements, fulfilment, no sales margin
- GM / admin / finance: floor, margin, cost, exceptions, reports
- auditors: history and change trail, not editable operational actions

---

## 6. Integration Design

### 6.1 Integration pattern

Every provider should follow the same shape:
- connection record
- provider adapter
- sync job
- run log
- error log
- external references
- retry policy
- manual override option

### 6.2 Provider categories

#### Warehouse management systems
- inbound stock
- stock movement
- dispatch status
- lot / pallet updates

#### ERP / accounting systems
- invoice sync
- receipt sync
- journal / ledger export
- customer balances

#### Email and document systems
- inbound email capture
- document ingestion
- OCR extraction
- human review queue

#### Carrier and logistics systems
- dispatch events
- delivery status
- exception updates

### 6.3 Integration rules

- No provider-specific logic inside core UI pages.
- Every sync must be idempotent.
- Every external mutation should be replayable or recoverable.
- Dry-run should be available before destructive syncs.
- External IDs should always be stored.
- Conflicts should never overwrite silently.

---

## 7. Delivery Plan

This is the recommended implementation order.

### Phase 25 — Contracts, roles, and migration readiness
Goal:
- expand the role model safely
- define external reference strategy
- define import and sync contracts
- prepare visibility rules

Exit criteria:
- new roles exist safely
- old roles still work
- sensitive values are redacted correctly
- external reference pattern is agreed

### Phase 26 — Legacy data import foundation
Goal:
- build import templates
- support dry-run and commit
- support duplicate detection and validation
- create import logs and row-level exceptions

Exit criteria:
- previous tracker data can be imported safely
- bad rows are isolated, not destructive
- imports are repeatable and auditable

### Phase 27 — Integration framework
Goal:
- create provider registry
- create sync runs and error tracking
- connect external references
- build manual sync and test connection flows

Exit criteria:
- AIMS can talk to a third-party system through a standard integration pattern
- sync failures are visible and recoverable

### Phase 28 — Warehouse foundation
Goal:
- add warehouse master data
- assign containers to warehouses
- enforce warehouse gate rules
- build receiving and stock ledger core

Exit criteria:
- a cleared container can be routed into warehouse stock
- stock is visible and auditable

### Phase 29 — Stock grading and movement
Goal:
- add stock items, movements, wastage, dump, reserve, and release
- support UoM conversion where needed

Exit criteria:
- warehouse receiving flows are correct
- stock availability is mathematically sound

### Phase 30 — CRM and customer controls
Goal:
- customer master
- contacts
- KYC
- credit controls
- region control

Exit criteria:
- customers can be onboarded with review gates
- sales rep access is properly scoped

### Phase 31 — Daily pricing
Goal:
- daily price lists
- benchmark capture
- publish/unpublish
- role-based read-only views

Exit criteria:
- each warehouse has a published daily price
- no order can proceed without a valid published price

### Phase 32 — Sales orders and approvals
Goal:
- order creation
- soft reserve
- custom pricing
- approval routing
- rejection and release

Exit criteria:
- order lifecycle works end-to-end
- no stock leakage occurs
- no cost floor is exposed to restricted roles

### Phase 33 — Fulfilment and dispatch
Goal:
- pick, pack, ready, gate pass, dispatch
- partial fulfilment
- container roll-up to sold status

Exit criteria:
- approved orders can be dispatched
- inventory and container states stay aligned

### Phase 34 — Receipts, ageing, and reporting
Goal:
- customer receipts
- outstanding balances
- ageing
- collection visibility
- management reporting

Exit criteria:
- receivables are traceable and current
- leadership reports match operational records

### Phase 35 — Reconciliation and hardening
Goal:
- stock reconciliation
- order reconciliation
- receipt reconciliation
- external mismatch handling
- retry and recovery flows

Exit criteria:
- system can be run alongside a third-party stack without silent data drift

---

## 8. Recommended Pilot Strategy

To reduce risk, do not launch all cities at once.

Pilot sequence:
1. one org
2. one city
3. one warehouse
4. one sales team
5. one external integration
6. one import cycle

Then expand only after:
- stock math is stable
- pricing is stable
- order approvals are stable
- reconciliation is stable
- support team can resolve exceptions quickly

---

## 9. Acceptance Gates Before Build Starts

Before implementation begins, these decisions should be explicitly approved:
- which system is the source of truth for stock
- which system is the source of truth for orders
- which system is the source of truth for receipts
- which third-party systems are in scope first
- how historical data will be cut over
- how long parallel run will last
- which roles map from the current system to the expanded roles
- what data can be redacted from non-financial roles

---

## 10. What This Plan Fixes

This version improves the original draft by adding:
- legacy import strategy
- third-party integration strategy
- reconciliation flow
- exception handling
- source-of-truth rules
- pilot rollout order
- operational SOP structure

It also keeps the original business intent:
- warehouse operations
- sales pricing and approvals
- fulfilment
- customer ledger
- role-based visibility
- analytics and reporting

This is now ready to be used as the master delivery plan before code starts.

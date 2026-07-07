# AIMS - Full Route Forward, Tightened ERP Spec

Status: Draft for implementation approval

This is a stricter build plan for the sales + warehouse expansion of AIMS.
It is written as an ERP delivery spec, not a feature checklist.

Core principle:
- do not build screens before the data model and permissions are stable
- do not expose cost or floor logic to non-financial roles
- do not allow stock movement, order approval, or dispatch to happen outside server-side rules
- do not start city-wide rollout until one pilot warehouse is stable end to end

The delivery order below is intentional:
1. lock contracts and permissions
2. build warehouse master and stock math
3. add CRM and credit control
4. add pricing and approval logic
5. add sales order and reservation flow
6. add fulfilment and dispatch
7. add receipts and receivables
8. add reporting
9. add integration hooks and migration tools
10. harden, test, and roll out in one pilot lane first

---

## 0. Operating Assumptions

### 0.1 Business shape
- One company, one org model, one control plane.
- Multi-warehouse support is required, but phase 1 rollout is single warehouse.
- Single-currency operational logic is INR for pricing, margin, and local costs.
- Imports may carry USD or AED inputs where needed, but operational sales flow remains INR.
- The warehouse logic must fit an imported-fruit cold-storage business, not a generic dry-goods warehouse.

### 0.2 Source of truth
- AIMS is the operating source of truth for:
  - containers
  - warehouse stock
  - prices
  - sales orders
  - receipts
  - approvals
  - audit history
- Third-party WMS or ERP systems are external systems of record only for the data they own.
- Every sync must preserve external identity and sync history.

### 0.3 Non-negotiable invariants
- Every container must have both `container_no` and `bl_no`.
- A container cannot enter `InWarehouse` unless a warehouse is assigned.
- A container cannot be sold unless stock exists in a graded, sellable state.
- A sales order cannot be confirmed unless a published day price exists for that warehouse and date.
- Cost floor and margin must never be visible to roles without financial permission.
- A custom price below floor must be escalated silently to leadership, not shown to sales.
- Every stock change must create an auditable movement record.
- Every manual override must carry user, time, reason, and old/new values.
- Every cold-room placement, temperature breach, quarantine hold, and release must be auditable.
- FEFO should govern allocation unless a manual override is approved.
- Imported lots must remain traceable from container to cold room to stock item to sale line.

---

## 1. Chunk 0 - Foundation and Contracts

Goal:
- lock the role model, visibility model, and ERP contracts before new modules are added.

### 1.1 Role model
Lock the roles and their real-world meaning:
- `admin`: full CRUD, team config, finance visibility, overrides, audit review
- `gm`: all business approvals, finance visibility, pricing authority
- `manager`: operational approvals, customer oversight, no finance visibility
- `sales_executive`: customer onboarding, order capture, receipts entry, region-limited
- `warehouse`: receive, grade, pick, pack, dispatch
- `finance`: receipts, reconciliation, financial reporting
- `viewer`: read-only

### 1.2 Role migration rules
- Existing users must be mapped to the new roles with a migration table.
- Old permissions should not be removed until the new matrix is validated in staging.
- A compatibility layer should translate old access checks to the new capabilities during migration.
- No hard delete of old role data until the pilot is live and stable.

### 1.3 Permission matrix
Define capability flags, not ad hoc UI checks:
- `financials.view`
- `cost.view`
- `price.floor.view`
- `warehouse.assign`
- `warehouse.receive`
- `warehouse.adjust`
- `warehouse.fulfil`
- `crm.write`
- `crm.kyc.approve`
- `salesorder.write`
- `salesorder.approve`
- `price.publish`
- `price.override.approve`
- `receipt.record`
- `integration.manage`
- `audit.view`

### 1.4 Field-level redaction rules
Define which fields are visible by role:
- cost, floor price, margin, and profit only for `admin`, `gm`, and `finance`
- sales sees published price, discount, and approval status only
- warehouse sees stock quantities and fulfilment state, not margins
- manager sees operational queues, not floor logic
- viewer sees whatever the owning page would show in a read-only safe mode

### 1.5 Prisma scope for this chunk
Add only what is needed to support the next phase:
- `Role`
- `Capability`
- `UserRole`
- `Warehouse`
- `Region` or warehouse-city mapping if not already present
- `PermissionAudit` or generic `AuditLog`

Do not add sales, stock, or pricing tables yet unless required to enforce the permission layer.

### 1.6 Exit criteria
- role mapping is defined and tested
- field visibility is documented in code and spec
- cost redaction works server-side
- first pilot scope is agreed: one city, one warehouse, one sales team
- no module built in later chunks can bypass this contract

---

## 2. Chunk 1 - Warehouse Master Data

Goal:
- create the warehouse backbone and make container-to-warehouse assignment mandatory.

### 2.1 Data model
Add:
- `Warehouse`
- warehouse fields: `name`, `code`, `city`, `state`, `address`, `is_active`, `org_id`
- optional cold-storage fields:
  - `storage_type`
  - `temperature_min_c`
  - `temperature_max_c`
  - `humidity_target`
  - `capacity_tonnes`
  - `cold_room_count`
  - `is_cold_storage`
- container fields:
  - `warehouse_id`
  - `warehouse_assigned_at`
  - `warehouse_assigned_by`
  - `warehouse_in_date`
  - `warehouse_status`
- `cold_room_id?`
- `temperature_state?`
- `quarantine_status?`
  - `conditioning_state?`

### 2.2 Workflow rules
- a cleared container must be assigned a warehouse before it can enter stock
- warehouse assignment must preserve audit history
- reassignment after inbound must require manager/admin approval and logged reason
- `InWarehouse` transition must fail if warehouse is missing
- imported fruit can enter quarantine or hold before it becomes sellable
- cold-room assignment should be possible at inbound and movable only with audit
- temperature breaches should create exception events instead of disappearing
- ripening or conditioning should be modelled as a controlled warehouse state where relevant

### 2.3 APIs and screens
- warehouse CRUD
- assign warehouse action on container detail
- inbound queue filtered by cleared, unassigned containers
- basic warehouse admin screen
- warehouse list with city, active state, and container counts
- cold-room and storage-zone configuration
- quarantine and release actions for inbound fruit
- conditioning / ripening release actions where the fruit category requires it

### 2.4 Invariants
- one container can point to one active warehouse at a time
- warehouse codes must be unique per org
- container cannot be marked received without warehouse assignment

### 2.5 Exit criteria
- a cleared container can be assigned to a warehouse
- workflow blocks any inbound without warehouse
- warehouse admin can create, edit, and disable warehouses

---

## 3. Chunk 2 - Stock Receiving and Grading

Goal:
- turn inbound containers into sellable inventory with correct stock math and cold-chain traceability.

### 3.1 Data model
Add:
- `StockItem`
- `StockMovement`
- optional `StorageZone`
- optional `TemperatureLog`

StockItem should support:
- `container_id`
- `warehouse_id`
- `cold_room_id`
- `item`
- `variety`
- `grade`
- `uom`
- `qty_received`
- `qty_available`
- `qty_reserved`
- `qty_sold`
- `qty_wastage`
- `qty_dump`
- `per_unit_weight_kg`
- `lot_no`
- `pallet_no`
- `pack_date?`
- `expiry_date?`
- `best_before_date?`
- `storage_condition?`
- `ripening_state?`
- `age_days` derived

StockMovement should record:
- receive
- grade
- reserve
- release
- sell
- wastage
- dump
- adjust
- sync

### 3.2 Workflow rules
- receive a container into warehouse stock
- split it into one or more stock items
- grading must create stock items, not overwrite source container state
- any change in stock must go through movement records
- available quantity must always equal:
  - received - reserved - sold - wastage - dump ± adjustments
- stock allocation should prefer oldest acceptable lot first
- sellable stock must respect quality state and storage condition
- damaged or temperature-breached stock should be quarantined before disposal or downgrade

### 3.3 Units of measure
Start with:
- box
- kg

Then extend to:
- pallet
- punnet
- container

For imported fruit, unit logic should also support carton or case pack where needed.

Conversions must be explicit and measurable:
- use weight or conversion factor per stock item
- do not assume all items share one conversion rate

### 3.4 Screens and APIs
- receive and grade screen
- live stock list
- ageing view
- reserve/release action
- wastage/dump action
- cold-room occupancy view
- quarantine queue
- temperature exception view

### 3.5 Exit criteria
- warehouse can receive a container
- it can be graded into sellable stock
- stock math stays correct after reserve, release, wastage, and dump
- ageing and availability are visible
- FEFO allocation is working
- cold-room and quarantine states are tracked

---

## 4. Chunk 3 - CRM and Customer Control

Goal:
- make customer onboarding controlled, validated, and credit-aware.

### 4.1 Data model
Add:
- `Customer`
- `CustomerContact`
- `CustomerKycDocument`

Customer should include:
- `customer_type`
- `region`
- `tier`
- `gstin`
- `pan`
- `fssai_no`
- `address`
- `credit_limit`
- `payment_terms_days`
- `kyc_status`
- `kyc_reviewed_by`
- `kyc_reviewed_at`
- `credit_hold`
- `assigned_rep_id`

### 4.2 Validation rules
- GSTIN required
- PAN required
- phone and email should be validated where present
- KYC status must be explicit: draft, submitted, approved, rejected

### 4.3 Operational rules
- sales rep can create a customer in draft or submitted state
- only approved customers can place orders
- credit hold blocks order confirmation
- region scoping must prevent sales execs from managing customers outside their region

### 4.4 Screens and APIs
- customer create/edit screen
- KYC upload panel
- approval queue
- customer history
- assigned rep view

### 4.5 Exit criteria
- a sales rep can onboard a customer
- mandatory identifiers are validated
- credit and KYC gates work before ordering
- region isolation is enforced

---

## 5. Chunk 4 - Daily Pricing

Goal:
- create the HQ day-price desk with strict publishing rules and hidden floor logic.

### 5.1 Data model
Add:
- `PriceList`
- `PriceListItem`

PriceList should support:
- `warehouse_id`
- `price_date`
- `status` draft / published
- `published_by`
- `published_at`

PriceListItem should support:
- `item`
- `variety`
- `grade`
- `uom`
- `tier`
- `price`
- `benchmark_price`

### 5.2 Pricing rules
- one price list per warehouse per date
- published prices become the default for sales ordering
- price desk can be published and then locked
- unpublish should require admin or GM and leave an audit trail
- floor price stays server-side only

### 5.3 Visibility rules
- sales sees published price only
- warehouse sees stock and availability only
- finance and leadership can see floor, margin, and benchmark
- redaction must happen at the API layer, not only in the UI

### 5.4 Exit criteria
- a published day price exists per warehouse/date
- sales cannot confirm an order without it
- floor logic never leaks to non-financial roles
- pricing history is preserved

---

## 6. Chunk 5 - Sales Order Creation

Goal:
- allow order capture, pricing, and approval without breaking stock or margin controls.

### 6.1 Data model
Add:
- `SalesOrder`
- `SalesOrderLine`

SalesOrder should include:
- `order_no`
- `customer_id`
- `warehouse_id`
- `status`
- `price_approval_status`
- `fulfilment_status`
- `order_date`
- `subtotal`
- `discount_total`
- `tax_total`
- `grand_total`
- `amount_received`
- `approved_by`
- `approved_at`
- `rejection_reason`

SalesOrderLine should include:
- `stock_item_id`
- `container_id`
- `item`
- `variety`
- `grade`
- `uom`
- `qty`
- `day_price`
- `unit_price`
- `is_custom_price`
- `discount`
- `tax_rate_pct`
- `line_tax`
- `line_total`
- `damage_qty`

### 6.2 Pricing behavior
- order lines default to the published day price
- sales can propose custom price or discount
- any line below day price marks the order for approval
- anything below floor routes to leadership silently
- order approval must never reveal cost or floor to sales roles

### 6.3 Reservation behavior
- submit creates a soft reserve
- reject or cancel releases the reserve
- expiry should be supported so stale reservations do not freeze stock
- reserve and release must create movements

### 6.4 Approval routing
- manager approves allowed custom prices
- GM/admin approves floor-sensitive overrides
- route must depend on the price delta and role

### 6.5 Exit criteria
- an order can be created with default pricing
- custom pricing is supported
- stock is reserved on submit
- approval routing works without cost leakage

---

## 7. Chunk 6 - Fulfilment and Dispatch

Goal:
- complete the warehouse loop from approved order to delivered dispatch.

### 7.1 Data model
Add:
- `GatePass`

GatePass should include:
- `sales_order_id`
- `pass_no`
- `vehicle_no`
- `driver_name`
- `qty_summary`
- `dispatched_by`
- `dispatched_at`

### 7.2 Fulfilment workflow
- Pick
- Pack
- Ready
- Gate Pass
- Dispatched

### 7.3 Fulfilment rules
- only approved orders enter fulfilment
- partial dispatch must be allowed
- dispatch must reduce reserved and increase sold quantities correctly
- dispatch must update container sale status
- dispatch rollback must be controlled and logged

### 7.4 Screens and APIs
- fulfilment board
- pick-pack-ready pipeline
- gate pass generator
- partial dispatch action
- order-to-container trace view

### 7.5 Exit criteria
- approved order can be fulfilled end to end
- partial dispatch works
- container and stock state remain consistent after dispatch

---

## 8. Chunk 7 - Receipts and Customer Ledger

Goal:
- turn orders into receivables and collections without losing traceability.

### 8.1 Data model
Add:
- `CustomerReceipt`

Receipt should include:
- `customer_id`
- `sales_order_id`
- `amount`
- `mode`
- `reference`
- `received_date`
- `recorded_by`

### 8.2 Ledger behavior
- each order must contribute to outstanding balance
- receipts can be linked to one order or multiple orders if required
- ageing must be derived from invoice/order state and unpaid balances
- payment posting must be auditable

### 8.3 Exit criteria
- money can be recorded against orders
- outstanding balance is correct
- customer ageing is visible
- order-level collections history exists

---

## 9. Chunk 8 - Reporting and Visibility

Goal:
- make leadership and operations dashboards accurate and role-safe.

### 9.1 Required views
- sales analytics
- stock dashboard
- customer history
- ageing report
- margin report
- warehouse performance
- order funnel

### 9.2 Financial visibility rules
- management-only financial views
- sales sees operational data only
- warehouse sees inventory and dispatch only
- finance sees collections, receivables, and variance

### 9.3 Output formats
- printable invoice
- printable order summary
- printable gate pass
- exportable report tables

### 9.4 Exit criteria
- leadership gets the numbers
- operations get the board they need
- role-based redaction remains intact in reports

---

## 10. Chunk 9 - Integrations and Migration

Goal:
- make AIMS compatible with prior data and third-party warehouse systems.

### 10.1 Migration tools
Add support for:
- import preview
- column mapping
- duplicate detection
- staged commit
- row-level errors
- rollback of staged batches

Required import groups:
- containers
- warehouses
- customers
- stock snapshots
- orders
- receipts
- documents
- price lists

### 10.2 Integration model
Add:
- provider registry
- external reference table
- sync runs
- sync checkpoints
- error queue
- retry log

### 10.3 WMS / ERP integration
- integrate with third-party WMS using explicit mapping
- no hard-coded provider logic inside business pages
- sync errors must be visible
- reconciliation must be manual when needed

### 10.4 Exit criteria
- previous tracker data can be uploaded safely
- third-party warehouse or ERP sync is traceable
- mismatches create exceptions, not silent overwrites

---

## 11. Chunk 10 - Hardening and Rollout

Goal:
- stabilize the system before broader rollout.

### 11.1 Test coverage
- workflow smoke tests for:
  - warehouse assignment
  - receive and grade
  - pricing publish
  - order creation
  - approval routing
  - fulfilment
  - receipt posting
  - import preview
  - sync retries

### 11.2 Audit and logging
- audit every mutation
- capture actor, timestamp, before/after, reason, and source
- audit logs must be filterable by entity and by action type

### 11.3 Seed and demo data
- seed roles
- seed one pilot warehouse
- seed one city
- seed customer tiers and sample price lists

### 11.4 Rollout strategy
- pilot one warehouse
- pilot one city
- pilot one sales team
- expand only after the full cycle is stable

### 11.5 Exit criteria
- smoke tests pass
- audit log is complete
- seed data supports demo and QA
- the pilot can run without engineer babysitting

---

## 12. Implementation Rules

1. Do not add tables just because they feel likely later.
   - add the smallest model required for the next chunk
   - keep the schema composable

2. Do not leak financial logic into UI code.
   - floor, margin, and cost remain server-side controls
   - UI may display derived outcomes, not secret inputs

3. Do not allow duplicate business state.
   - source of truth should exist once
   - derived views must be recomputable

4. Do not let third-party sync mutate core workflow silently.
   - sync should create events and exceptions
   - manual review should always be possible

5. Do not scale rollout before one lane is proven.
   - first warehouse
   - first city
   - first sales team
   - then replication

---

## 13. Build Order Summary

Recommended sequence:
1. foundation and permissions
2. warehouse master
3. stock receiving and grading
4. CRM and credit control
5. pricing desk
6. sales orders and reservation
7. fulfilment and dispatch
8. receipts and receivables
9. reporting
10. migration and integrations
11. hardening and rollout

If we follow this order, the schema will stay stable and the ERP logic will not need to be rewritten halfway through the build.

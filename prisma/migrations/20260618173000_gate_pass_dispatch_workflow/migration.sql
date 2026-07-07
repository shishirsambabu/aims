-- Gate pass and dispatch workflow for warehouse fulfilment.

CREATE TYPE "GatePassStatus" AS ENUM (
  'Picked',
  'Packed',
  'Ready',
  'PartiallyDispatched',
  'Dispatched',
  'Cancelled'
);

CREATE TABLE "gate_passes" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "stock_item_id" TEXT,
  "container_id" TEXT,
  "gate_pass_no" TEXT NOT NULL,
  "vehicle_no" TEXT,
  "driver_name" TEXT,
  "notes" TEXT,
  "status" "GatePassStatus" NOT NULL DEFAULT 'Picked',
  "picked_at" TIMESTAMP(3),
  "packed_at" TIMESTAMP(3),
  "ready_at" TIMESTAMP(3),
  "dispatched_at" TIMESTAMP(3),
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "gate_passes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "gate_passes"
  ADD CONSTRAINT "gate_passes_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_passes"
  ADD CONSTRAINT "gate_passes_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_passes"
  ADD CONSTRAINT "gate_passes_stock_item_id_fkey"
  FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gate_passes"
  ADD CONSTRAINT "gate_passes_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gate_passes"
  ADD CONSTRAINT "gate_passes_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "gate_passes_org_id_gate_pass_no_key" ON "gate_passes"("org_id", "gate_pass_no");
CREATE INDEX "gate_passes_org_id_idx" ON "gate_passes"("org_id");
CREATE INDEX "gate_passes_warehouse_id_idx" ON "gate_passes"("warehouse_id");
CREATE INDEX "gate_passes_status_idx" ON "gate_passes"("status");
CREATE INDEX "gate_passes_container_id_idx" ON "gate_passes"("container_id");

CREATE TABLE "gate_pass_lines" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "gate_pass_id" TEXT NOT NULL,
  "stock_item_id" TEXT NOT NULL,
  "qty_planned" DECIMAL(14,3) NOT NULL,
  "qty_dispatched" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "uom" "StockUom" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "gate_pass_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "gate_pass_lines"
  ADD CONSTRAINT "gate_pass_lines_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_pass_lines"
  ADD CONSTRAINT "gate_pass_lines_gate_pass_id_fkey"
  FOREIGN KEY ("gate_pass_id") REFERENCES "gate_passes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_pass_lines"
  ADD CONSTRAINT "gate_pass_lines_stock_item_id_fkey"
  FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "gate_pass_lines_org_id_idx" ON "gate_pass_lines"("org_id");
CREATE INDEX "gate_pass_lines_gate_pass_id_idx" ON "gate_pass_lines"("gate_pass_id");
CREATE INDEX "gate_pass_lines_stock_item_id_idx" ON "gate_pass_lines"("stock_item_id");

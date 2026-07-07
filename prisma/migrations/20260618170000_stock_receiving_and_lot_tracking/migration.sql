-- Stock receiving, lot tracking, and movement ledger for cold-store operations.

CREATE TYPE "StockMovementKind" AS ENUM (
  'Receive',
  'Grade',
  'Reserve',
  'Release',
  'Sell',
  'Wastage',
  'Dump',
  'Adjust',
  'Sync'
);

CREATE TYPE "StockUom" AS ENUM (
  'Box',
  'Kg',
  'Pallet',
  'Punnet',
  'Container',
  'Carton',
  'CasePack'
);

CREATE TABLE "stock_items" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "container_id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "variety" TEXT,
  "grade" TEXT,
  "uom" "StockUom" NOT NULL,
  "qty_received" DECIMAL(14,3) NOT NULL,
  "qty_available" DECIMAL(14,3) NOT NULL,
  "qty_reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "qty_sold" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "qty_wastage" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "qty_dump" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "per_unit_weight_kg" DECIMAL(14,3),
  "lot_no" TEXT,
  "pallet_no" TEXT,
  "pack_date" TIMESTAMP(3),
  "expiry_date" TIMESTAMP(3),
  "best_before_date" TIMESTAMP(3),
  "storage_condition" TEXT,
  "ripening_state" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "containers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_items"
  ADD COLUMN "parent_stock_item_id" TEXT;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_parent_stock_item_id_fkey"
  FOREIGN KEY ("parent_stock_item_id") REFERENCES "stock_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "stock_items_org_id_idx" ON "stock_items"("org_id");
CREATE INDEX "stock_items_warehouse_id_idx" ON "stock_items"("warehouse_id");
CREATE INDEX "stock_items_container_id_idx" ON "stock_items"("container_id");
CREATE INDEX "stock_items_parent_stock_item_id_idx" ON "stock_items"("parent_stock_item_id");
CREATE INDEX "stock_items_item_grade_warehouse_id_idx" ON "stock_items"("item", "grade", "warehouse_id");

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "stock_item_id" TEXT NOT NULL,
  "kind" "StockMovementKind" NOT NULL,
  "qty" DECIMAL(14,3) NOT NULL,
  "uom" "StockUom" NOT NULL,
  "reason" TEXT,
  "ref_type" TEXT,
  "ref_id" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_stock_item_id_fkey"
  FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "stock_movements_org_id_idx" ON "stock_movements"("org_id");
CREATE INDEX "stock_movements_stock_item_id_idx" ON "stock_movements"("stock_item_id");
CREATE INDEX "stock_movements_kind_idx" ON "stock_movements"("kind");

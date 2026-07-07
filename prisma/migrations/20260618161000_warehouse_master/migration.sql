-- Warehouse master data for the imported fruit cold-storage workflow.

CREATE TABLE "warehouses" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT,
  "address" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "storage_type" TEXT,
  "is_cold_storage" BOOLEAN NOT NULL DEFAULT true,
  "temperature_min_c" DECIMAL(5,2),
  "temperature_max_c" DECIMAL(5,2),
  "humidity_target" DECIMAL(5,2),
  "capacity_tonnes" DECIMAL(10,2),
  "cold_room_count" INTEGER,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "warehouses"
  ADD CONSTRAINT "warehouses_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "warehouses_org_id_code_key" ON "warehouses"("org_id", "code");
CREATE INDEX "warehouses_org_id_idx" ON "warehouses"("org_id");

ALTER TABLE "containers"
  ADD COLUMN "warehouse_id" TEXT,
  ADD COLUMN "warehouse_assigned_at" TIMESTAMP(3),
  ADD COLUMN "warehouse_assigned_by_id" TEXT,
  ADD COLUMN "warehouse_in_date" TIMESTAMP(3);

ALTER TABLE "containers"
  ADD CONSTRAINT "containers_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "containers_warehouse_id_idx" ON "containers"("warehouse_id");

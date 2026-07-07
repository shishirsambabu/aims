CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "org_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_sequences_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "document_sequences_org_id_scope_key" ON "document_sequences"("org_id", "scope");
CREATE INDEX "document_sequences_org_id_idx" ON "document_sequences"("org_id");

ALTER TABLE "sales_orders"
  ADD COLUMN "reservation_expires_at" TIMESTAMPTZ,
  ADD COLUMN "pricing_override_reason" TEXT;

CREATE INDEX "sales_orders_reservation_expires_at_idx"
  ON "sales_orders"("reservation_expires_at")
  WHERE "reservation_expires_at" IS NOT NULL;

ALTER TABLE "gate_passes" ADD COLUMN "exception_reason" TEXT;

ALTER TABLE "stock_items"
  ADD CONSTRAINT "stock_items_quantities_nonnegative" CHECK (
    "qty_received" >= 0 AND "qty_available" >= 0 AND "qty_reserved" >= 0 AND
    "qty_sold" >= 0 AND "qty_wastage" >= 0 AND "qty_dump" >= 0
  );

ALTER TABLE "gate_pass_lines"
  ADD CONSTRAINT "gate_pass_lines_quantities_valid" CHECK (
    "qty_planned" >= 0 AND "qty_dispatched" >= 0 AND "qty_dispatched" <= "qty_planned"
  );

ALTER TABLE "sales_order_lines"
  ADD CONSTRAINT "sales_order_lines_values_valid" CHECK (
    "qty" > 0 AND "unit_price" >= 0 AND "floor_price" >= 0 AND
    "discount_amount" >= 0 AND "line_total" >= 0
  );

ALTER TABLE "document_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_sequences" FORCE ROW LEVEL SECURITY;

CREATE POLICY "aims_no_direct_access" ON "document_sequences"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

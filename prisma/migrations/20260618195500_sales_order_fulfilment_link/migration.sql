-- Add sales order link to gate passes so fulfilment can be driven from approved orders.
ALTER TABLE "gate_passes"
ADD COLUMN "sales_order_id" TEXT;

CREATE INDEX "gate_passes_sales_order_id_idx" ON "gate_passes"("sales_order_id");

ALTER TABLE "gate_passes"
ADD CONSTRAINT "gate_passes_sales_order_id_fkey"
FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

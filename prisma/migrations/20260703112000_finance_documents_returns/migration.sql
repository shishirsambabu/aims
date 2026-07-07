CREATE TYPE "SalesInvoiceStatus" AS ENUM ('Draft', 'Issued', 'Cancelled');
CREATE TYPE "SalesReturnStatus" AS ENUM ('Draft', 'Posted', 'Cancelled');
CREATE TYPE "CreditNoteStatus" AS ENUM ('Draft', 'Issued', 'Cancelled');
CREATE TYPE "ReturnDisposition" AS ENUM ('Restock', 'QualityHold', 'Dump', 'Reject');

CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_order_id" TEXT,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "SalesInvoiceStatus" NOT NULL DEFAULT 'Issued',
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "taxable_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_invoice_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT NOT NULL,
    "sales_order_line_id" TEXT,
    "stock_item_id" TEXT,
    "line_no" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "variety" TEXT,
    "grade" TEXT,
    "uom" "StockUom" NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "taxable_amount" DECIMAL(14,2) NOT NULL,
    "tax_rate_pct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_returns" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "return_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_order_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "return_date" TIMESTAMP(3) NOT NULL,
    "status" "SalesReturnStatus" NOT NULL DEFAULT 'Draft',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_return_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sales_return_id" TEXT NOT NULL,
    "sales_order_line_id" TEXT,
    "stock_item_id" TEXT,
    "line_no" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "variety" TEXT,
    "grade" TEXT,
    "uom" "StockUom" NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "disposition" "ReturnDisposition" NOT NULL DEFAULT 'QualityHold',
    "credit_amount" DECIMAL(14,2),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "credit_note_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_order_id" TEXT,
    "sales_invoice_id" TEXT,
    "credit_date" TIMESTAMP(3) NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'Issued',
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_invoices_org_id_invoice_no_key" ON "sales_invoices"("org_id", "invoice_no");
CREATE UNIQUE INDEX "sales_invoices_org_id_sales_order_id_key" ON "sales_invoices"("org_id", "sales_order_id");
CREATE INDEX "sales_invoices_org_id_idx" ON "sales_invoices"("org_id");
CREATE INDEX "sales_invoices_customer_id_idx" ON "sales_invoices"("customer_id");
CREATE INDEX "sales_invoices_sales_order_id_idx" ON "sales_invoices"("sales_order_id");
CREATE INDEX "sales_invoices_status_idx" ON "sales_invoices"("status");
CREATE INDEX "sales_invoices_invoice_date_idx" ON "sales_invoices"("invoice_date");

CREATE UNIQUE INDEX "sales_invoice_lines_sales_invoice_id_line_no_key" ON "sales_invoice_lines"("sales_invoice_id", "line_no");
CREATE INDEX "sales_invoice_lines_org_id_idx" ON "sales_invoice_lines"("org_id");
CREATE INDEX "sales_invoice_lines_sales_invoice_id_idx" ON "sales_invoice_lines"("sales_invoice_id");
CREATE INDEX "sales_invoice_lines_sales_order_line_id_idx" ON "sales_invoice_lines"("sales_order_line_id");
CREATE INDEX "sales_invoice_lines_stock_item_id_idx" ON "sales_invoice_lines"("stock_item_id");

CREATE UNIQUE INDEX "sales_returns_org_id_return_no_key" ON "sales_returns"("org_id", "return_no");
CREATE INDEX "sales_returns_org_id_idx" ON "sales_returns"("org_id");
CREATE INDEX "sales_returns_customer_id_idx" ON "sales_returns"("customer_id");
CREATE INDEX "sales_returns_sales_order_id_idx" ON "sales_returns"("sales_order_id");
CREATE INDEX "sales_returns_warehouse_id_idx" ON "sales_returns"("warehouse_id");
CREATE INDEX "sales_returns_status_idx" ON "sales_returns"("status");

CREATE UNIQUE INDEX "sales_return_lines_sales_return_id_line_no_key" ON "sales_return_lines"("sales_return_id", "line_no");
CREATE INDEX "sales_return_lines_org_id_idx" ON "sales_return_lines"("org_id");
CREATE INDEX "sales_return_lines_sales_return_id_idx" ON "sales_return_lines"("sales_return_id");
CREATE INDEX "sales_return_lines_sales_order_line_id_idx" ON "sales_return_lines"("sales_order_line_id");
CREATE INDEX "sales_return_lines_stock_item_id_idx" ON "sales_return_lines"("stock_item_id");

CREATE UNIQUE INDEX "credit_notes_org_id_credit_note_no_key" ON "credit_notes"("org_id", "credit_note_no");
CREATE INDEX "credit_notes_org_id_idx" ON "credit_notes"("org_id");
CREATE INDEX "credit_notes_customer_id_idx" ON "credit_notes"("customer_id");
CREATE INDEX "credit_notes_sales_order_id_idx" ON "credit_notes"("sales_order_id");
CREATE INDEX "credit_notes_sales_invoice_id_idx" ON "credit_notes"("sales_invoice_id");
CREATE INDEX "credit_notes_status_idx" ON "credit_notes"("status");
CREATE INDEX "credit_notes_credit_date_idx" ON "credit_notes"("credit_date");

ALTER TABLE "sales_invoice_lines"
  ADD CONSTRAINT "sales_invoice_lines_values_valid" CHECK (
    "qty" > 0 AND "unit_price" >= 0 AND "taxable_amount" >= 0 AND
    "tax_rate_pct" >= 0 AND "tax_amount" >= 0 AND "line_total" >= 0
  );

ALTER TABLE "sales_return_lines"
  ADD CONSTRAINT "sales_return_lines_values_valid" CHECK (
    "qty" > 0 AND ("credit_amount" IS NULL OR "credit_amount" >= 0)
  );

ALTER TABLE "credit_notes"
  ADD CONSTRAINT "credit_notes_amount_valid" CHECK ("amount" > 0);

ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales_invoices','sales_invoice_lines','sales_returns','sales_return_lines','credit_notes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS aims_no_direct_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY aims_no_direct_access ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- CreateEnum
CREATE TYPE "ReceiptMethod" AS ENUM ('Cash', 'BankTransfer', 'UPI', 'Cheque', 'Card', 'Adjustment');

-- CreateEnum
CREATE TYPE "CustomerReceiptStatus" AS ENUM ('Posted', 'Cancelled');

-- DropForeignKey
ALTER TABLE "stock_items" DROP CONSTRAINT "stock_items_warehouse_id_fkey";

-- DropIndex
DROP INDEX "containers_warehouse_id_idx";

-- DropIndex
DROP INDEX "documents_deleted_at_idx";

-- DropIndex
DROP INDEX "gate_passes_sales_order_id_idx";

-- DropIndex
DROP INDEX "payments_deleted_at_idx";

-- DropIndex
DROP INDEX "sales_approval_status_idx";

-- DropIndex
DROP INDEX "suppliers_approval_status_idx";

-- DropIndex
DROP INDEX "suppliers_deleted_at_idx";

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "due_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "customer_receipts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL,
    "method" "ReceiptMethod" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "amount" DECIMAL(14,2) NOT NULL,
    "reference_no" TEXT,
    "bank_name" TEXT,
    "notes" TEXT,
    "status" "CustomerReceiptStatus" NOT NULL DEFAULT 'Posted',
    "created_by_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_receipt_allocations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_receipts_org_id_idx" ON "customer_receipts"("org_id");

-- CreateIndex
CREATE INDEX "customer_receipts_customer_id_idx" ON "customer_receipts"("customer_id");

-- CreateIndex
CREATE INDEX "customer_receipts_status_idx" ON "customer_receipts"("status");

-- CreateIndex
CREATE INDEX "customer_receipts_receipt_date_idx" ON "customer_receipts"("receipt_date");

-- CreateIndex
CREATE UNIQUE INDEX "customer_receipts_org_id_receipt_no_key" ON "customer_receipts"("org_id", "receipt_no");

-- CreateIndex
CREATE INDEX "customer_receipt_allocations_org_id_idx" ON "customer_receipt_allocations"("org_id");

-- CreateIndex
CREATE INDEX "customer_receipt_allocations_receipt_id_idx" ON "customer_receipt_allocations"("receipt_id");

-- CreateIndex
CREATE INDEX "customer_receipt_allocations_sales_order_id_idx" ON "customer_receipt_allocations"("sales_order_id");

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipt_allocations" ADD CONSTRAINT "customer_receipt_allocations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipt_allocations" ADD CONSTRAINT "customer_receipt_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "customer_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipt_allocations" ADD CONSTRAINT "customer_receipt_allocations_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "StockQualityStatus" AS ENUM ('Released', 'QualityHold', 'Quarantine', 'Rejected');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "credit_review_date" TIMESTAMP(3),
ADD COLUMN     "customer_tier" TEXT,
ADD COLUMN     "payment_terms_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "price_list_items" ADD COLUMN     "benchmark_price" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "sales_order_lines" ADD COLUMN     "price_list_item_id" TEXT;

-- AlterTable
ALTER TABLE "sales_quote_lines" ADD COLUMN     "price_list_item_id" TEXT;

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "quality_hold_reason" TEXT,
ADD COLUMN     "quality_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "quality_reviewed_by_id" TEXT,
ADD COLUMN     "quality_status" "StockQualityStatus" NOT NULL DEFAULT 'Released',
ADD COLUMN     "temperature_at_receipt_c" DECIMAL(5,2),
ADD COLUMN     "temperature_breach" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "warehouse_locations" ADD COLUMN     "temperature_max_c" DECIMAL(5,2),
ADD COLUMN     "temperature_min_c" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "sales_order_lines_price_list_item_id_idx" ON "sales_order_lines"("price_list_item_id");

-- CreateIndex
CREATE INDEX "sales_quote_lines_price_list_item_id_idx" ON "sales_quote_lines"("price_list_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_cycle_count_lines_cycle_count_id_stock_item_id_key" ON "warehouse_cycle_count_lines"("cycle_count_id", "stock_item_id");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quote_lines" ADD CONSTRAINT "sales_quote_lines_price_list_item_id_fkey" FOREIGN KEY ("price_list_item_id") REFERENCES "price_list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_price_list_item_id_fkey" FOREIGN KEY ("price_list_item_id") REFERENCES "price_list_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

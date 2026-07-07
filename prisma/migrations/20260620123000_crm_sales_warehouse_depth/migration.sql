-- CreateEnum
CREATE TYPE "CrmLeadStatus" AS ENUM ('New', 'Qualified', 'Converted', 'Disqualified');

-- CreateEnum
CREATE TYPE "CrmOpportunityStage" AS ENUM ('Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost');

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('Open', 'Done');

-- CreateEnum
CREATE TYPE "WarehouseLocationType" AS ENUM ('Room', 'Zone', 'Bin', 'Dock', 'Staging');

-- CreateEnum
CREATE TYPE "CycleCountStatus" AS ENUM ('Draft', 'InProgress', 'Completed');

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "location_id" TEXT;

-- CreateTable
CREATE TABLE "sales_order_revisions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "change_type" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "lead_no" TEXT NOT NULL,
    "customer_id" TEXT,
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "source" TEXT,
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'New',
    "region" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "interested_in" TEXT,
    "next_follow_up_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "notes" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_opportunities" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "opportunity_no" TEXT NOT NULL,
    "lead_id" TEXT,
    "customer_id" TEXT,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "stage" "CrmOpportunityStage" NOT NULL DEFAULT 'Prospecting',
    "amount" DECIMAL(14,2),
    "probability_pct" DECIMAL(5,2),
    "expected_close_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "task_no" TEXT NOT NULL,
    "customer_id" TEXT,
    "lead_id" TEXT,
    "opportunity_id" TEXT,
    "assignee_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'Open',
    "due_at" TIMESTAMP(3),
    "remind_at" TIMESTAMP(3),
    "priority" TEXT DEFAULT 'Normal',
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "quote_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "price_list_id" TEXT,
    "quote_date" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'Draft',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'Draft',
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "converted_order_id" TEXT,
    "gross_amount" DECIMAL(14,2),
    "discount_amount" DECIMAL(14,2),
    "net_amount" DECIMAL(14,2),
    "notes" TEXT,
    "created_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quote_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sales_quote_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "stock_item_id" TEXT,
    "item" TEXT NOT NULL,
    "variety" TEXT,
    "grade" TEXT,
    "uom" "StockUom" NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "floor_price" DECIMAL(14,2) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quote_revisions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sales_quote_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "change_type" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_quote_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_locations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseLocationType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "capacity_units" DECIMAL(14,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_cycle_counts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "count_no" TEXT NOT NULL,
    "status" "CycleCountStatus" NOT NULL DEFAULT 'Draft',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_cycle_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_cycle_count_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "cycle_count_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "location_id" TEXT,
    "expected_qty" DECIMAL(14,3) NOT NULL,
    "counted_qty" DECIMAL(14,3) NOT NULL,
    "variance" DECIMAL(14,3) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_cycle_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_order_revisions_org_id_idx" ON "sales_order_revisions"("org_id");

-- CreateIndex
CREATE INDEX "sales_order_revisions_sales_order_id_idx" ON "sales_order_revisions"("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_revisions_org_id_sales_order_id_revision_no_key" ON "sales_order_revisions"("org_id", "sales_order_id", "revision_no");

-- CreateIndex
CREATE INDEX "crm_leads_org_id_idx" ON "crm_leads"("org_id");

-- CreateIndex
CREATE INDEX "crm_leads_status_idx" ON "crm_leads"("status");

-- CreateIndex
CREATE INDEX "crm_leads_customer_id_idx" ON "crm_leads"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_leads_org_id_lead_no_key" ON "crm_leads"("org_id", "lead_no");

-- CreateIndex
CREATE INDEX "crm_opportunities_org_id_idx" ON "crm_opportunities"("org_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_customer_id_idx" ON "crm_opportunities"("customer_id");

-- CreateIndex
CREATE INDEX "crm_opportunities_owner_id_idx" ON "crm_opportunities"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_opportunities_org_id_opportunity_no_key" ON "crm_opportunities"("org_id", "opportunity_no");

-- CreateIndex
CREATE INDEX "crm_tasks_org_id_idx" ON "crm_tasks"("org_id");

-- CreateIndex
CREATE INDEX "crm_tasks_status_idx" ON "crm_tasks"("status");

-- CreateIndex
CREATE INDEX "crm_tasks_assignee_id_idx" ON "crm_tasks"("assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_tasks_org_id_task_no_key" ON "crm_tasks"("org_id", "task_no");

-- CreateIndex
CREATE INDEX "sales_quotes_org_id_idx" ON "sales_quotes"("org_id");

-- CreateIndex
CREATE INDEX "sales_quotes_customer_id_idx" ON "sales_quotes"("customer_id");

-- CreateIndex
CREATE INDEX "sales_quotes_warehouse_id_idx" ON "sales_quotes"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_quotes_org_id_quote_no_key" ON "sales_quotes"("org_id", "quote_no");

-- CreateIndex
CREATE INDEX "sales_quote_lines_org_id_idx" ON "sales_quote_lines"("org_id");

-- CreateIndex
CREATE INDEX "sales_quote_lines_sales_quote_id_idx" ON "sales_quote_lines"("sales_quote_id");

-- CreateIndex
CREATE INDEX "sales_quote_revisions_org_id_idx" ON "sales_quote_revisions"("org_id");

-- CreateIndex
CREATE INDEX "sales_quote_revisions_sales_quote_id_idx" ON "sales_quote_revisions"("sales_quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_quote_revisions_org_id_sales_quote_id_revision_no_key" ON "sales_quote_revisions"("org_id", "sales_quote_id", "revision_no");

-- CreateIndex
CREATE INDEX "warehouse_locations_org_id_idx" ON "warehouse_locations"("org_id");

-- CreateIndex
CREATE INDEX "warehouse_locations_warehouse_id_idx" ON "warehouse_locations"("warehouse_id");

-- CreateIndex
CREATE INDEX "warehouse_locations_parent_id_idx" ON "warehouse_locations"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_org_id_warehouse_id_code_key" ON "warehouse_locations"("org_id", "warehouse_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_cycle_counts_org_id_idx" ON "warehouse_cycle_counts"("org_id");

-- CreateIndex
CREATE INDEX "warehouse_cycle_counts_warehouse_id_idx" ON "warehouse_cycle_counts"("warehouse_id");

-- CreateIndex
CREATE INDEX "warehouse_cycle_counts_status_idx" ON "warehouse_cycle_counts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_cycle_counts_org_id_count_no_key" ON "warehouse_cycle_counts"("org_id", "count_no");

-- CreateIndex
CREATE INDEX "warehouse_cycle_count_lines_org_id_idx" ON "warehouse_cycle_count_lines"("org_id");

-- CreateIndex
CREATE INDEX "warehouse_cycle_count_lines_cycle_count_id_idx" ON "warehouse_cycle_count_lines"("cycle_count_id");

-- CreateIndex
CREATE INDEX "warehouse_cycle_count_lines_stock_item_id_idx" ON "warehouse_cycle_count_lines"("stock_item_id");

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_revisions" ADD CONSTRAINT "sales_order_revisions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_revisions" ADD CONSTRAINT "sales_order_revisions_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quote_lines" ADD CONSTRAINT "sales_quote_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quote_lines" ADD CONSTRAINT "sales_quote_lines_sales_quote_id_fkey" FOREIGN KEY ("sales_quote_id") REFERENCES "sales_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quote_lines" ADD CONSTRAINT "sales_quote_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quote_revisions" ADD CONSTRAINT "sales_quote_revisions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quote_revisions" ADD CONSTRAINT "sales_quote_revisions_sales_quote_id_fkey" FOREIGN KEY ("sales_quote_id") REFERENCES "sales_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_cycle_counts" ADD CONSTRAINT "warehouse_cycle_counts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_cycle_counts" ADD CONSTRAINT "warehouse_cycle_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_cycle_count_lines" ADD CONSTRAINT "warehouse_cycle_count_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_cycle_count_lines" ADD CONSTRAINT "warehouse_cycle_count_lines_cycle_count_id_fkey" FOREIGN KEY ("cycle_count_id") REFERENCES "warehouse_cycle_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_cycle_count_lines" ADD CONSTRAINT "warehouse_cycle_count_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_cycle_count_lines" ADD CONSTRAINT "warehouse_cycle_count_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

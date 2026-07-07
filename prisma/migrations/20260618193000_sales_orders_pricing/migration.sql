-- CreateEnum
CREATE TYPE "PriceListStatus" AS ENUM ('Draft', 'Published', 'Archived');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('Draft', 'PendingApproval', 'Approved', 'Rejected', 'Cancelled', 'PartiallyFulfilled', 'Fulfilled');

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "price_date" TIMESTAMP(3) NOT NULL,
    "status" "PriceListStatus" NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "published_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "variety" TEXT,
    "grade" TEXT,
    "uom" "StockUom" NOT NULL,
    "base_price" DECIMAL(14,2) NOT NULL,
    "floor_price" DECIMAL(14,2) NOT NULL,
    "max_discount_pct" DECIMAL(6,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "price_list_id" TEXT,
    "order_date" TIMESTAMP(3) NOT NULL,
    "requested_date" TIMESTAMP(3),
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'Draft',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'Draft',
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "review_notes" TEXT,
    "notes" TEXT,
    "total_qty" DECIMAL(14,3),
    "gross_amount" DECIMAL(14,2),
    "discount_amount" DECIMAL(14,2),
    "net_amount" DECIMAL(14,2),
    "reserved_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_org_id_warehouse_id_price_date_key" ON "price_lists"("org_id", "warehouse_id", "price_date");

-- CreateIndex
CREATE INDEX "price_lists_org_id_idx" ON "price_lists"("org_id");

-- CreateIndex
CREATE INDEX "price_lists_warehouse_id_idx" ON "price_lists"("warehouse_id");

-- CreateIndex
CREATE INDEX "price_lists_status_idx" ON "price_lists"("status");

-- CreateIndex
CREATE INDEX "price_list_items_org_id_idx" ON "price_list_items"("org_id");

-- CreateIndex
CREATE INDEX "price_list_items_price_list_id_idx" ON "price_list_items"("price_list_id");

-- CreateIndex
CREATE INDEX "price_list_items_item_grade_uom_idx" ON "price_list_items"("item", "grade", "uom");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_org_id_order_no_key" ON "sales_orders"("org_id", "order_no");

-- CreateIndex
CREATE INDEX "sales_orders_org_id_idx" ON "sales_orders"("org_id");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "sales_orders_warehouse_id_idx" ON "sales_orders"("warehouse_id");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_approval_status_idx" ON "sales_orders"("approval_status");

-- CreateIndex
CREATE INDEX "sales_order_lines_org_id_idx" ON "sales_order_lines"("org_id");

-- CreateIndex
CREATE INDEX "sales_order_lines_sales_order_id_idx" ON "sales_order_lines"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_lines_stock_item_id_idx" ON "sales_order_lines"("stock_item_id");

-- CreateIndex
CREATE INDEX "sales_order_lines_item_grade_uom_idx" ON "sales_order_lines"("item", "grade", "uom");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_sales_order_id_line_no_key" ON "sales_order_lines"("sales_order_id", "line_no");

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

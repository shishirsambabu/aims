-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'manager', 'viewer');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('Booked', 'InTransit', 'AtPort', 'CustomsClearance', 'Cleared', 'InWarehouse', 'PartiallySold', 'FullySold');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BillOfLading', 'CommercialInvoice', 'PackingList', 'BillOfEntry', 'CertificateOfOrigin', 'PhytosanitaryCertificate', 'Insurance', 'DeliveryOrder', 'Other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('Pending', 'Uploaded', 'Verified', 'Expired');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Pending', 'Partial', 'Paid');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'AED', 'INR');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT DEFAULT 'India',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_id" TEXT,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sl_no" INTEGER,
    "container_no" TEXT NOT NULL,
    "bl_no" TEXT NOT NULL,
    "supplier_id" TEXT,
    "customer" TEXT,
    "port" TEXT,
    "port_code" TEXT,
    "item" TEXT,
    "variety" TEXT,
    "no_of_boxes" INTEGER,
    "status" "ContainerStatus" NOT NULL DEFAULT 'Booked',
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "booking_date" TIMESTAMP(3),
    "remarks" TEXT,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "invoice_no" TEXT,
    "invoice_date" TIMESTAMP(3),
    "invoice_value" DECIMAL(14,2),
    "invoice_currency" "Currency" NOT NULL DEFAULT 'USD',
    "be_no" TEXT,
    "be_date" TIMESTAMP(3),
    "hs_code" TEXT,
    "net_weight_kg" DECIMAL(12,2),
    "gross_weight_kg" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container_costs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "be_invoice_value_inr" DECIMAL(14,2),
    "exchange_rate" DECIMAL(12,4),
    "customs_duty" DECIMAL(14,2),
    "clearing_charges" DECIMAL(14,2),
    "liner_charges" DECIMAL(14,2),
    "detention" DECIMAL(14,2),
    "cha_charges" DECIMAL(14,2),
    "transport" DECIMAL(14,2),
    "oh_proportion" DECIMAL(14,2),
    "claim_deduction" DECIMAL(14,2),
    "other_charges" DECIMAL(14,2),
    "total_cost" DECIMAL(14,2),
    "rate_per_box_landing" DECIMAL(14,2),
    "rate_per_box" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "sold_qty" INTEGER,
    "avg_price" DECIMAL(14,2),
    "sale_value" DECIMAL(14,2),
    "damage_qty" INTEGER,
    "damage_value" DECIMAL(14,2),
    "profit" DECIMAL(14,2),
    "profit_per_box" DECIMAL(14,2),
    "margin_pct" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "supplier_name" TEXT,
    "amount_requested" DECIMAL(14,2) NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "request_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "paid_date" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'Pending',
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "doc_no" TEXT,
    "container_no" TEXT,
    "bl_no" TEXT,
    "supplier_name" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'Pending',
    "file_url" TEXT,
    "file_path" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE INDEX "suppliers_org_id_idx" ON "suppliers"("org_id");

-- CreateIndex
CREATE INDEX "containers_org_id_idx" ON "containers"("org_id");

-- CreateIndex
CREATE INDEX "containers_container_no_idx" ON "containers"("container_no");

-- CreateIndex
CREATE INDEX "containers_bl_no_idx" ON "containers"("bl_no");

-- CreateIndex
CREATE INDEX "containers_status_idx" ON "containers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "containers_org_id_container_no_key" ON "containers"("org_id", "container_no");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_items_container_id_key" ON "shipment_items"("container_id");

-- CreateIndex
CREATE INDEX "shipment_items_org_id_idx" ON "shipment_items"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "container_costs_container_id_key" ON "container_costs"("container_id");

-- CreateIndex
CREATE INDEX "container_costs_org_id_idx" ON "container_costs"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_container_id_key" ON "sales"("container_id");

-- CreateIndex
CREATE INDEX "sales_org_id_idx" ON "sales"("org_id");

-- CreateIndex
CREATE INDEX "payments_org_id_idx" ON "payments"("org_id");

-- CreateIndex
CREATE INDEX "payments_container_id_idx" ON "payments"("container_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "documents_org_id_idx" ON "documents"("org_id");

-- CreateIndex
CREATE INDEX "documents_container_id_idx" ON "documents"("container_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_expiry_date_idx" ON "documents"("expiry_date");

-- CreateIndex
CREATE INDEX "activity_log_org_id_idx" ON "activity_log"("org_id");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "container_costs" ADD CONSTRAINT "container_costs_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


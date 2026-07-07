-- Customer CRM, KYC, and credit-control master data.

CREATE TYPE "CustomerKycStatus" AS ENUM (
  'Pending',
  'Approved',
  'Rejected'
);

CREATE TABLE "customers" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trade_name" TEXT,
  "gstin" TEXT,
  "pan" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "billing_address" TEXT,
  "shipping_address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "region" TEXT,
  "assigned_rep_id" TEXT,
  "credit_limit" DECIMAL(14,2),
  "credit_hold" BOOLEAN NOT NULL DEFAULT false,
  "kyc_status" "CustomerKycStatus" NOT NULL DEFAULT 'Pending',
  "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PendingApproval',
  "pending_changes" JSONB,
  "requested_by_id" TEXT,
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "notes" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_assigned_rep_id_fkey"
  FOREIGN KEY ("assigned_rep_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "customers_org_id_code_key" ON "customers"("org_id", "code");
CREATE INDEX "customers_org_id_idx" ON "customers"("org_id");
CREATE INDEX "customers_assigned_rep_id_idx" ON "customers"("assigned_rep_id");
CREATE INDEX "customers_region_idx" ON "customers"("region");

CREATE TABLE "customer_contacts" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "designation" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customer_contacts"
  ADD CONSTRAINT "customer_contacts_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_contacts"
  ADD CONSTRAINT "customer_contacts_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "customer_contacts_org_id_idx" ON "customer_contacts"("org_id");
CREATE INDEX "customer_contacts_customer_id_idx" ON "customer_contacts"("customer_id");

CREATE TABLE "customer_kyc_documents" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "doc_type" TEXT NOT NULL,
  "doc_no" TEXT,
  "issue_date" TIMESTAMP(3),
  "expiry_date" TIMESTAMP(3),
  "file_name" TEXT,
  "file_path" TEXT,
  "file_url" TEXT,
  "status" "CustomerKycStatus" NOT NULL DEFAULT 'Pending',
  "notes" TEXT,
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "customer_kyc_documents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customer_kyc_documents"
  ADD CONSTRAINT "customer_kyc_documents_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_kyc_documents"
  ADD CONSTRAINT "customer_kyc_documents_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_kyc_documents"
  ADD CONSTRAINT "customer_kyc_documents_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "customer_kyc_documents_org_id_idx" ON "customer_kyc_documents"("org_id");
CREATE INDEX "customer_kyc_documents_customer_id_idx" ON "customer_kyc_documents"("customer_id");
CREATE INDEX "customer_kyc_documents_status_idx" ON "customer_kyc_documents"("status");

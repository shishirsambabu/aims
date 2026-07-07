-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('Unmatched', 'Matched', 'Exception', 'Ignored');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('Draft', 'Posted', 'Reversed');

-- CreateEnum
CREATE TYPE "FinancePeriodStatus" AS ENUM ('Open', 'Closing', 'Closed', 'Reopened');

-- CreateEnum
CREATE TYPE "CustomerDisputeStatus" AS ENUM ('Open', 'UnderReview', 'Approved', 'Rejected', 'Resolved');

-- CreateEnum
CREATE TYPE "TemperatureBreachSeverity" AS ENUM ('Info', 'Warning', 'Critical');

-- CreateEnum
CREATE TYPE "TemperatureBreachTaskStatus" AS ENUM ('Open', 'Acknowledged', 'Resolved', 'Escalated');

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_no" TEXT,
    "statement_date" TIMESTAMP(3) NOT NULL,
    "value_date" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "reference_no" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(14,2),
    "status" "BankReconciliationStatus" NOT NULL DEFAULT 'Unmatched',
    "customer_id" TEXT,
    "customer_receipt_id" TEXT,
    "match_confidence" DECIMAL(5,2),
    "match_notes" TEXT,
    "uploaded_by_id" TEXT,
    "matched_by_id" TEXT,
    "matched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "entry_no" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'Posted',
    "source_type" TEXT,
    "source_id" TEXT,
    "narration" TEXT NOT NULL,
    "posted_by_id" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reverse_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_period_closes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "status" "FinancePeriodStatus" NOT NULL DEFAULT 'Open',
    "checklist" JSONB,
    "receivables_total" DECIMAL(14,2),
    "bank_unmatched_count" INTEGER NOT NULL DEFAULT 0,
    "journal_imbalance_count" INTEGER NOT NULL DEFAULT 0,
    "close_notes" TEXT,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "reopened_by_id" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_period_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_disputes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "dispute_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sales_invoice_id" TEXT,
    "sales_return_id" TEXT,
    "credit_note_id" TEXT,
    "status" "CustomerDisputeStatus" NOT NULL DEFAULT 'Open',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "reason" TEXT NOT NULL,
    "claim_amount" DECIMAL(14,2),
    "approved_amount" DECIMAL(14,2),
    "resolution_notes" TEXT,
    "created_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cold_room_readings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "location_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "temperature_c" DECIMAL(5,2) NOT NULL,
    "humidity_pct" DECIMAL(5,2),
    "source" TEXT NOT NULL DEFAULT 'Manual',
    "notes" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cold_room_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temperature_breach_tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "task_no" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "location_id" TEXT,
    "reading_id" TEXT,
    "severity" "TemperatureBreachSeverity" NOT NULL DEFAULT 'Warning',
    "status" "TemperatureBreachTaskStatus" NOT NULL DEFAULT 'Open',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target_min_c" DECIMAL(5,2),
    "target_max_c" DECIMAL(5,2),
    "actual_temp_c" DECIMAL(5,2),
    "assigned_to_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temperature_breach_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_statement_lines_org_id_idx" ON "bank_statement_lines"("org_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_statement_date_idx" ON "bank_statement_lines"("statement_date");

-- CreateIndex
CREATE INDEX "bank_statement_lines_status_idx" ON "bank_statement_lines"("status");

-- CreateIndex
CREATE INDEX "bank_statement_lines_customer_id_idx" ON "bank_statement_lines"("customer_id");

-- CreateIndex
CREATE INDEX "bank_statement_lines_customer_receipt_id_idx" ON "bank_statement_lines"("customer_receipt_id");

-- CreateIndex
CREATE INDEX "journal_entries_org_id_idx" ON "journal_entries"("org_id");

-- CreateIndex
CREATE INDEX "journal_entries_entry_date_idx" ON "journal_entries"("entry_date");

-- CreateIndex
CREATE INDEX "journal_entries_status_idx" ON "journal_entries"("status");

-- CreateIndex
CREATE INDEX "journal_entries_source_type_source_id_idx" ON "journal_entries"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_org_id_entry_no_key" ON "journal_entries"("org_id", "entry_no");

-- CreateIndex
CREATE INDEX "journal_entry_lines_org_id_idx" ON "journal_entry_lines"("org_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journal_entry_id_idx" ON "journal_entry_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_account_code_idx" ON "journal_entry_lines"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_lines_journal_entry_id_line_no_key" ON "journal_entry_lines"("journal_entry_id", "line_no");

-- CreateIndex
CREATE INDEX "finance_period_closes_org_id_idx" ON "finance_period_closes"("org_id");

-- CreateIndex
CREATE INDEX "finance_period_closes_status_idx" ON "finance_period_closes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "finance_period_closes_org_id_period_key_key" ON "finance_period_closes"("org_id", "period_key");

-- CreateIndex
CREATE INDEX "customer_disputes_org_id_idx" ON "customer_disputes"("org_id");

-- CreateIndex
CREATE INDEX "customer_disputes_customer_id_idx" ON "customer_disputes"("customer_id");

-- CreateIndex
CREATE INDEX "customer_disputes_status_idx" ON "customer_disputes"("status");

-- CreateIndex
CREATE INDEX "customer_disputes_priority_idx" ON "customer_disputes"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "customer_disputes_org_id_dispute_no_key" ON "customer_disputes"("org_id", "dispute_no");

-- CreateIndex
CREATE INDEX "cold_room_readings_org_id_idx" ON "cold_room_readings"("org_id");

-- CreateIndex
CREATE INDEX "cold_room_readings_warehouse_id_idx" ON "cold_room_readings"("warehouse_id");

-- CreateIndex
CREATE INDEX "cold_room_readings_location_id_idx" ON "cold_room_readings"("location_id");

-- CreateIndex
CREATE INDEX "cold_room_readings_recorded_at_idx" ON "cold_room_readings"("recorded_at");

-- CreateIndex
CREATE INDEX "temperature_breach_tasks_org_id_idx" ON "temperature_breach_tasks"("org_id");

-- CreateIndex
CREATE INDEX "temperature_breach_tasks_warehouse_id_idx" ON "temperature_breach_tasks"("warehouse_id");

-- CreateIndex
CREATE INDEX "temperature_breach_tasks_location_id_idx" ON "temperature_breach_tasks"("location_id");

-- CreateIndex
CREATE INDEX "temperature_breach_tasks_status_idx" ON "temperature_breach_tasks"("status");

-- CreateIndex
CREATE INDEX "temperature_breach_tasks_severity_idx" ON "temperature_breach_tasks"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "temperature_breach_tasks_org_id_task_no_key" ON "temperature_breach_tasks"("org_id", "task_no");

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_customer_receipt_id_fkey" FOREIGN KEY ("customer_receipt_id") REFERENCES "customer_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_by_id_fkey" FOREIGN KEY ("matched_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_period_closes" ADD CONSTRAINT "finance_period_closes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_period_closes" ADD CONSTRAINT "finance_period_closes_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_period_closes" ADD CONSTRAINT "finance_period_closes_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_disputes" ADD CONSTRAINT "customer_disputes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_disputes" ADD CONSTRAINT "customer_disputes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_disputes" ADD CONSTRAINT "customer_disputes_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_disputes" ADD CONSTRAINT "customer_disputes_sales_return_id_fkey" FOREIGN KEY ("sales_return_id") REFERENCES "sales_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_disputes" ADD CONSTRAINT "customer_disputes_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_disputes" ADD CONSTRAINT "customer_disputes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_disputes" ADD CONSTRAINT "customer_disputes_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cold_room_readings" ADD CONSTRAINT "cold_room_readings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cold_room_readings" ADD CONSTRAINT "cold_room_readings_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cold_room_readings" ADD CONSTRAINT "cold_room_readings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cold_room_readings" ADD CONSTRAINT "cold_room_readings_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_breach_tasks" ADD CONSTRAINT "temperature_breach_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_breach_tasks" ADD CONSTRAINT "temperature_breach_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_breach_tasks" ADD CONSTRAINT "temperature_breach_tasks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_breach_tasks" ADD CONSTRAINT "temperature_breach_tasks_reading_id_fkey" FOREIGN KEY ("reading_id") REFERENCES "cold_room_readings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_breach_tasks" ADD CONSTRAINT "temperature_breach_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temperature_breach_tasks" ADD CONSTRAINT "temperature_breach_tasks_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_statement_lines"
  ADD CONSTRAINT "bank_statement_lines_amounts_valid" CHECK (
    "debit_amount" >= 0 AND "credit_amount" >= 0 AND ("debit_amount" > 0 OR "credit_amount" > 0)
  );

ALTER TABLE "journal_entry_lines"
  ADD CONSTRAINT "journal_entry_lines_amounts_valid" CHECK (
    "debit_amount" >= 0 AND "credit_amount" >= 0 AND NOT ("debit_amount" > 0 AND "credit_amount" > 0)
  );

ALTER TABLE "customer_disputes"
  ADD CONSTRAINT "customer_disputes_amounts_valid" CHECK (
    ("claim_amount" IS NULL OR "claim_amount" >= 0) AND
    ("approved_amount" IS NULL OR "approved_amount" >= 0)
  );

ALTER TABLE "cold_room_readings"
  ADD CONSTRAINT "cold_room_readings_humidity_valid" CHECK (
    "humidity_pct" IS NULL OR ("humidity_pct" >= 0 AND "humidity_pct" <= 100)
  );

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bank_statement_lines','journal_entries','journal_entry_lines',
    'finance_period_closes','customer_disputes',
    'cold_room_readings','temperature_breach_tasks'
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

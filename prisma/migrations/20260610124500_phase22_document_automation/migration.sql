-- Phase 22: document automation queue for email/OCR/compression workflows.

CREATE TABLE "document_automation_jobs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "review_status" TEXT NOT NULL DEFAULT 'PendingReview',
    "container_id" TEXT,
    "document_id" TEXT,
    "file_name" TEXT,
    "file_path" TEXT,
    "sender" TEXT,
    "subject" TEXT,
    "match_summary" TEXT,
    "extracted_data" JSONB,
    "confidence" DECIMAL(5,2),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_automation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_automation_jobs_org_id_idx" ON "document_automation_jobs"("org_id");
CREATE INDEX "document_automation_jobs_status_idx" ON "document_automation_jobs"("status");
CREATE INDEX "document_automation_jobs_review_status_idx" ON "document_automation_jobs"("review_status");
CREATE INDEX "document_automation_jobs_container_id_idx" ON "document_automation_jobs"("container_id");

ALTER TABLE "document_automation_jobs" ADD CONSTRAINT "document_automation_jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

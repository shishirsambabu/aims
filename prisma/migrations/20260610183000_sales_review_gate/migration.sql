ALTER TABLE "sales"
  ADD COLUMN "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PendingApproval',
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_notes" TEXT;

CREATE INDEX "sales_approval_status_idx" ON "sales"("approval_status");

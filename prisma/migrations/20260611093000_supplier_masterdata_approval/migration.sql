ALTER TABLE "suppliers"
  ADD COLUMN "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'Approved',
  ADD COLUMN "pending_changes" JSONB,
  ADD COLUMN "requested_by_id" TEXT,
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_notes" TEXT;

CREATE INDEX "suppliers_approval_status_idx" ON "suppliers"("approval_status");

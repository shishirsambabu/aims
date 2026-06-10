-- Production hardening: archive operational records instead of hard deleting.

ALTER TABLE "documents"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by_id" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "payments"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by_id" TEXT,
  ADD COLUMN "delete_reason" TEXT;

ALTER TABLE "suppliers"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by_id" TEXT,
  ADD COLUMN "delete_reason" TEXT;

CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");
CREATE INDEX "suppliers_deleted_at_idx" ON "suppliers"("deleted_at");

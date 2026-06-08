-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('Draft', 'PendingApproval', 'Approved', 'Rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'clearing_agent';
ALTER TYPE "Role" ADD VALUE 'finance';
ALTER TYPE "Role" ADD VALUE 'auditor';

-- AlterTable
ALTER TABLE "container_costs" ADD COLUMN     "finalized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "finalized_at" TIMESTAMP(3),
ADD COLUMN     "finalized_by_id" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'PendingApproval',
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "requested_by_id" TEXT;


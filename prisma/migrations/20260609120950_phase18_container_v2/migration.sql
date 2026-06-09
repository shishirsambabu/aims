-- AlterTable
ALTER TABLE "containers" ADD COLUMN     "ata" TIMESTAMP(3),
ADD COLUMN     "do_upto" TIMESTAMP(3),
ADD COLUMN     "empty_return_date" TIMESTAMP(3),
ADD COLUMN     "line" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "original_eta" TIMESTAMP(3),
ADD COLUMN     "package_type" TEXT,
ADD COLUMN     "per_package_weight" DECIMAL(10,3),
ADD COLUMN     "pol" TEXT,
ADD COLUMN     "transhipment" TEXT,
ADD COLUMN     "transit_time" INTEGER,
ADD COLUMN     "vessel" TEXT;

-- AlterTable
ALTER TABLE "shipment_items" ADD COLUMN     "packing_list_no" TEXT;


ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "delivery_instructions" TEXT;

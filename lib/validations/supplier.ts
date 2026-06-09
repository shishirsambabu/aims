import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required"),
  country: optionalString,
  contactName: optionalString,
  email: z
    .union([z.string().trim().email("Invalid email"), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  phone: optionalString,
});

export const updateSupplierSchema = createSupplierSchema.partial();

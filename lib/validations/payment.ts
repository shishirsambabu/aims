import { z } from "zod";

const CURRENCIES = ["USD", "AED", "INR"] as const;
const STATUSES = ["Pending", "Partial", "Paid"] as const;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

export const createPaymentSchema = z.object({
  containerId: z.string().min(1, "Container is required"),
  amountRequested: z.coerce.number().positive("Amount must be greater than 0"),
  currency: z.enum(CURRENCIES).default("USD"),
  requestDate: optionalDate,
  dueDate: optionalDate,
  reference: optionalString,
  notes: optionalString,
});

export const updatePaymentSchema = z.object({
  amountPaid: z.coerce.number().min(0).optional(),
  paidDate: optionalDate,
  status: z.enum(STATUSES).optional(),
  reference: optionalString,
  notes: optionalString,
});

export type CreatePaymentInput = z.input<typeof createPaymentSchema>;

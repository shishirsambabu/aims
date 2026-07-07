import { z } from "zod";

const currencies = ["USD", "AED", "INR"] as const;
const methods = ["Cash", "BankTransfer", "UPI", "Cheque", "Card", "Adjustment"] as const;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

export const receiptAllocationSchema = z.object({
  salesOrderId: z.string().uuid("Sales order is required"),
  amount: z.coerce.number().positive("Allocation amount must be greater than 0"),
  notes: optionalString,
});

export const customerReceiptSchema = z
  .object({
    customerId: z.string().uuid("Customer is required"),
    receiptDate: optionalDate,
    method: z.enum(methods),
    currency: z.enum(currencies).default("INR"),
    amount: z.coerce.number().positive("Receipt amount must be greater than 0"),
    referenceNo: optionalString,
    bankName: optionalString,
    notes: optionalString,
    allocations: z.array(receiptAllocationSchema).min(1, "Add at least one allocation"),
  })
  .superRefine((value, ctx) => {
    const total = value.allocations.reduce((sum, line) => sum + Number(line.amount), 0);
    if (Math.abs(total - Number(value.amount)) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allocations"],
        message: "Allocations must total the receipt amount",
      });
    }
  });

export const customerReceiptCancelSchema = z.object({
  reason: z.string().trim().min(3, "Receipt cancellation reason is required"),
});

export type CustomerReceiptInput = z.input<typeof customerReceiptSchema>;
export type CustomerReceiptAllocationInput = z.input<typeof receiptAllocationSchema>;
export type CustomerReceiptCancelInput = z.input<typeof customerReceiptCancelSchema>;

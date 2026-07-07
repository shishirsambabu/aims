import { z } from "zod";

const currencies = ["USD", "AED", "INR"] as const;
const returnDispositions = ["Restock", "QualityHold", "Dump", "Reject"] as const;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const requiredReason = z.string().trim().min(3, "Reason is required");

const optionalDate = z
  .string()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));

export const issueSalesInvoiceSchema = z.object({
  salesOrderId: z.string().uuid("Sales order is required"),
  invoiceDate: optionalDate,
  dueDate: optionalDate,
  taxRatePct: z.coerce.number().min(0).max(100).default(0),
  notes: optionalString,
});

export const issueCreditNoteSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    salesInvoiceId: z.string().uuid().optional(),
    salesOrderId: z.string().uuid().optional(),
    creditDate: optionalDate,
    currency: z.enum(currencies).default("INR"),
    amount: z.coerce.number().positive("Credit amount must be greater than 0"),
    reason: requiredReason,
    notes: optionalString,
  })
  .superRefine((value, ctx) => {
    if (!value.customerId && !value.salesInvoiceId && !value.salesOrderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerId"],
        message: "Customer, invoice, or order is required",
      });
    }
  });

export const postSalesReturnSchema = z.object({
  salesOrderId: z.string().uuid("Sales order is required"),
  returnDate: optionalDate,
  reason: requiredReason,
  notes: optionalString,
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string().uuid("Order line is required"),
        qty: z.coerce.number().positive("Returned quantity must be greater than 0"),
        disposition: z.enum(returnDispositions).default("QualityHold"),
        creditAmount: z.coerce.number().nonnegative().optional(),
        reason: optionalString,
      })
    )
    .min(1, "Add at least one return line"),
});

export const financeDocumentCancelSchema = z.object({
  reason: requiredReason,
});

export type IssueSalesInvoiceInput = z.infer<typeof issueSalesInvoiceSchema>;
export type IssueCreditNoteInput = z.infer<typeof issueCreditNoteSchema>;
export type PostSalesReturnInput = z.infer<typeof postSalesReturnSchema>;

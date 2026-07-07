import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const optionalDate = z
  .string()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));

export const bankStatementLineSchema = z
  .object({
    bankName: z.string().trim().min(2, "Bank name is required"),
    accountNo: optionalString,
    statementDate: optionalDate,
    valueDate: optionalDate,
    description: z.string().trim().min(3, "Description is required"),
    referenceNo: optionalString,
    currency: z.enum(["USD", "AED", "INR"]).default("INR"),
    debitAmount: z.coerce.number().nonnegative().default(0),
    creditAmount: z.coerce.number().nonnegative().default(0),
    balanceAmount: z.coerce.number().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.debitAmount <= 0 && value.creditAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["creditAmount"],
        message: "Either debit or credit amount is required",
      });
    }
  });

export const bankMatchSchema = z.object({
  bankStatementLineId: z.string().uuid(),
  customerReceiptId: z.string().uuid(),
  matchNotes: z.string().trim().min(3, "Match notes are required"),
});

export const journalEntrySchema = z
  .object({
    entryDate: optionalDate,
    narration: z.string().trim().min(3, "Narration is required"),
    sourceType: optionalString,
    sourceId: optionalString,
    lines: z
      .array(
        z.object({
          accountCode: z.string().trim().min(2),
          accountName: z.string().trim().min(2),
          debitAmount: z.coerce.number().nonnegative().default(0),
          creditAmount: z.coerce.number().nonnegative().default(0),
          memo: optionalString,
        })
      )
      .min(2, "Journal entry needs at least two lines"),
  })
  .superRefine((value, ctx) => {
    const debit = value.lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const credit = value.lines.reduce((sum, line) => sum + line.creditAmount, 0);
    if (Math.abs(debit - credit) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "Journal entry must balance debit and credit",
      });
    }
    value.lines.forEach((line, index) => {
      if (line.debitAmount > 0 && line.creditAmount > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index],
          message: "A journal line cannot be both debit and credit",
        });
      }
      if (line.debitAmount <= 0 && line.creditAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index],
          message: "Each journal line needs debit or credit amount",
        });
      }
    });
  });

export const financePeriodCloseSchema = z.object({
  periodKey: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM period"),
  closeNotes: z.string().trim().min(3, "Close notes are required"),
});

export const customerDisputeSchema = z.object({
  customerId: z.string().uuid(),
  salesInvoiceId: z.string().uuid().optional(),
  salesReturnId: z.string().uuid().optional(),
  creditNoteId: z.string().uuid().optional(),
  priority: z.string().trim().default("Normal"),
  reason: z.string().trim().min(3, "Dispute reason is required"),
  claimAmount: z.coerce.number().nonnegative().optional(),
});

export const customerDisputeReviewSchema = z.object({
  disputeId: z.string().uuid(),
  status: z.enum(["UnderReview", "Approved", "Rejected", "Resolved"]),
  approvedAmount: z.coerce.number().nonnegative().optional(),
  resolutionNotes: z.string().trim().min(3, "Resolution notes are required"),
});

import { z } from "zod";

const money = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

const qty = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

const stockUoms = [
  "Box",
  "Kg",
  "Pallet",
  "Punnet",
  "Container",
  "Carton",
  "CasePack",
] as const;

export const priceListItemSchema = z.object({
  item: z.string().trim().min(1),
  variety: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  uom: z.enum(stockUoms),
  basePrice: money.refine((v) => v != null, "Base price is required"),
  floorPrice: money.refine((v) => v != null, "Floor price is required"),
  benchmarkPrice: money.optional(),
  maxDiscountPct: money.optional(),
  notes: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if ((value.basePrice ?? 0) <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["basePrice"], message: "Base price must be positive" });
  }
  if ((value.floorPrice ?? 0) <= 0 || (value.floorPrice ?? 0) > (value.basePrice ?? 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["floorPrice"], message: "Floor price must be positive and not exceed base price" });
  }
  if (value.maxDiscountPct != null && (value.maxDiscountPct < 0 || value.maxDiscountPct > 100)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxDiscountPct"], message: "Maximum discount must be between 0 and 100" });
  }
});

export const priceListSchema = z.object({
  warehouseId: z.string().uuid(),
  priceDate: z.coerce.date(),
  notes: z.string().trim().optional(),
  items: z.array(priceListItemSchema).min(1),
}).superRefine((value, ctx) => {
  const seen = new Set<string>();
  value.items.forEach((item, index) => {
    const key = [item.item, item.variety ?? "", item.grade ?? "", item.uom]
      .map((part) => part.trim().toLowerCase())
      .join("|");
    if (seen.has(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items", index], message: "Duplicate item, variety, grade, and UoM price row" });
    }
    seen.add(key);
  });
});

export const salesOrderLineSchema = z.object({
  stockItemId: z.string().uuid(),
  qty: qty.refine((v) => v != null && v > 0, "Quantity must be greater than zero"),
  unitPrice: money.refine((v) => v != null, "Unit price is required"),
  discountAmount: money.optional(),
  notes: z.string().trim().optional(),
});

export const salesOrderSchema = z.object({
  customerId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  priceListId: z.string().uuid().optional(),
  orderDate: z.coerce.date(),
  requestedDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  pricingOverrideReason: z.string().trim().min(3).max(500).optional(),
  lines: z.array(salesOrderLineSchema).min(1),
});

export const salesOrderReviewSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  reason: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (!value.reason || value.reason.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "A sales order review reason is required",
    });
  }
});

export const salesOrderAmendSchema = z.object({
  action: z.literal("amend"),
  reason: z.string().trim().min(3, "An amendment reason is required"),
  requestedDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  pricingOverrideReason: z.string().trim().min(3).max(500).optional(),
  lines: z.array(salesOrderLineSchema).min(1),
});

export const salesQuoteLineSchema = z.object({
  stockItemId: z.string().uuid().optional(),
  item: z.string().trim().min(1),
  variety: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  uom: z.enum(stockUoms),
  qty: qty.refine((v) => v != null && v > 0, "Quantity must be greater than zero"),
  unitPrice: money.refine((v) => v != null, "Unit price is required"),
  discountAmount: money.optional(),
  notes: z.string().trim().optional(),
});

export const salesQuoteSchema = z.object({
  customerId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  priceListId: z.string().uuid().optional(),
  quoteDate: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  pricingOverrideReason: z.string().trim().min(3).max(500).optional(),
  lines: z.array(salesQuoteLineSchema).min(1),
});

export const salesQuoteActionSchema = z.object({
  action: z.enum(["submit", "approve", "reject", "amend", "convert"]),
  reason: z.string().trim().optional(),
  quoteDate: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  pricingOverrideReason: z.string().trim().min(3).max(500).optional(),
  lines: z.array(salesQuoteLineSchema).min(1).optional(),
});

export type PriceListInput = z.infer<typeof priceListSchema>;
export type PriceListItemInput = z.infer<typeof priceListItemSchema>;
export type SalesOrderInput = z.infer<typeof salesOrderSchema>;
export type SalesOrderLineInput = z.infer<typeof salesOrderLineSchema>;
export type SalesOrderReviewInput = z.infer<typeof salesOrderReviewSchema>;
export type SalesOrderAmendInput = z.infer<typeof salesOrderAmendSchema>;
export type SalesQuoteInput = z.infer<typeof salesQuoteSchema>;
export type SalesQuoteLineInput = z.infer<typeof salesQuoteLineSchema>;
export type SalesQuoteActionInput = z.infer<typeof salesQuoteActionSchema>;

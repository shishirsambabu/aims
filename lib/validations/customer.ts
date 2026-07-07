import { z } from "zod";

import { CUSTOMER_CLASSES } from "@/lib/customer-segments";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalNum = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

export const customerSchema = z.object({
  code: z.string().trim().min(1, "Customer code is required"),
  name: z.string().trim().min(1, "Customer name is required"),
  tradeName: optionalString,
  gstin: z
    .string()
    .trim()
    .min(1, "GSTIN is required")
    .regex(/^[0-9A-Z]{15}$/, "GSTIN must be 15 uppercase alphanumeric characters"),
  pan: z
    .string()
    .trim()
    .min(1, "PAN is required")
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must match the standard Indian format"),
  email: optionalString,
  phone: optionalString,
  billingAddress: optionalString,
  shippingAddress: optionalString,
  deliveryInstructions: optionalString,
  city: optionalString,
  state: optionalString,
  region: optionalString,
  assignedRepId: z.string().uuid().optional(),
  creditLimit: optionalNum,
  customerTier: z.enum(CUSTOMER_CLASSES, {
    error: "Choose a valid customer class",
  }),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional().default(0),
  creditReviewDate: optionalDate,
  creditHold: z.coerce.boolean().optional().default(false),
  notes: optionalString,
}).superRefine((value, ctx) => {
  if (value.creditLimit == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["creditLimit"],
      message: "Credit limit is required, use 0 for prepaid customers",
    });
  }
  if (!value.customerTier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customerTier"],
      message: "Customer tier is required",
    });
  }
  if (!value.region) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["region"],
      message: "Region is required for sales ownership",
    });
  }
  if (!value.creditReviewDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["creditReviewDate"],
      message: "Next credit review date is required",
    });
  }
});

export const customerContactSchema = z.object({
  name: z.string().trim().min(1, "Contact name is required"),
  designation: optionalString,
  phone: optionalString,
  email: optionalString,
  isPrimary: z.coerce.boolean().optional().default(false),
  notes: optionalString,
});

export const customerKycDocumentSchema = z.object({
  docType: z.string().trim().min(1, "Document type is required"),
  docNo: optionalString,
  issueDate: optionalDate,
  expiryDate: optionalDate,
  fileName: optionalString,
  filePath: optionalString,
  fileUrl: optionalString,
  notes: optionalString,
});

export const customerReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: optionalString,
}).superRefine((value, ctx) => {
  if (!value.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "A customer review reason is required",
    });
  }
});

export const customerKycReviewSchema = z.object({
  docId: z.string().uuid("Document is required"),
  action: z.enum(["approve", "reject"]),
  reason: optionalString,
}).superRefine((value, ctx) => {
  if (value.action === "reject" && !value.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "A KYC rejection reason is required",
    });
  }
});

export type CustomerInput = z.input<typeof customerSchema>;
export type CustomerContactInput = z.input<typeof customerContactSchema>;
export type CustomerKycDocumentInput = z.input<typeof customerKycDocumentSchema>;
export type CustomerKycReviewInput = z.input<typeof customerKycReviewSchema>;

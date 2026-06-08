import { z } from "zod";

const DOC_TYPES = [
  "BillOfLading",
  "CommercialInvoice",
  "PackingList",
  "BillOfEntry",
  "CertificateOfOrigin",
  "PhytosanitaryCertificate",
  "Insurance",
  "DeliveryOrder",
  "Other",
] as const;

const DOC_STATUSES = ["Pending", "Uploaded", "Verified", "Expired"] as const;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

export const createDocumentSchema = z.object({
  containerId: z.string().min(1, "Container is required"),
  type: z.enum(DOC_TYPES),
  docNo: optionalString,
  issueDate: optionalDate,
  expiryDate: optionalDate,
  filePath: optionalString,
  fileUrl: optionalString,
  fileName: optionalString,
  fileSize: z.coerce.number().int().optional(),
  status: z.enum(DOC_STATUSES).default("Uploaded"),
});

export const updateDocumentSchema = z.object({
  status: z.enum(DOC_STATUSES).optional(),
  docNo: optionalString,
  issueDate: optionalDate,
  expiryDate: optionalDate,
});

export type CreateDocumentInput = z.input<typeof createDocumentSchema>;

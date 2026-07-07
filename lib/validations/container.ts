import { z } from "zod";

const CONTAINER_STATUS = [
  "Booked",
  "InTransit",
  "AtPort",
  "CustomsClearance",
  "Cleared",
  "InWarehouse",
  "EmptyReturned",
  "PartiallySold",
  "FullySold",
] as const;

// Accept "" / undefined from forms and coerce to null / number where useful.
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalInt = z
  .union([z.coerce.number().int(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

const optionalNum = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

// ISO 6346: 4 letters (owner + category) + 6 serial digits + 1 check digit.
const CONTAINER_NO_RE = /^[A-Z]{4}\d{7}$/;

export const createContainerSchema = z.object({
  containerNo: z
    .string()
    .trim()
    .min(1, "Container No is required")
    .transform((v) => v.toUpperCase())
    .refine((v) => CONTAINER_NO_RE.test(v), {
      message: "Container No must be ISO 6346 format — 4 letters + 7 digits (e.g. MNBU9052800)",
    }),
  // BL No is free-form (carriers use many formats).
  blNo: z.string().trim().min(1, "BL No is required"),
  supplierId: optionalString,
  warehouseId: optionalString,
  customer: optionalString,
  port: optionalString, // Port of Discharge (arrival)
  portCode: optionalString,
  pol: optionalString, // Port of Loading
  origin: optionalString,
  line: optionalString,
  vessel: optionalString,
  transhipment: optionalString,
  item: optionalString,
  variety: optionalString,
  packageType: optionalString,
  perPackageWeight: optionalNum,
  noOfBoxes: optionalInt,
  transitTime: optionalInt,
  status: z.enum(CONTAINER_STATUS).default("Booked"),
  etd: optionalDate,
  eta: optionalDate,
  ata: optionalDate,
  bookingDate: optionalDate,
  doUpto: optionalDate,
  emptyReturnDate: optionalDate,
  freeDays: optionalInt,
  lastFreeDate: optionalDate,
  // Shipper invoice details (create a shipment item).
  shipperInvoiceNo: optionalString,
  packingListNo: optionalString,
  remarks: optionalString,
});

export const updateContainerSchema = createContainerSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(CONTAINER_STATUS),
});

export type CreateContainerInput = z.input<typeof createContainerSchema>;
export type ContainerStatusValue = (typeof CONTAINER_STATUS)[number];

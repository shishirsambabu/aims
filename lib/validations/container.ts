import { z } from "zod";

const CONTAINER_STATUS = [
  "Booked",
  "InTransit",
  "AtPort",
  "CustomsClearance",
  "Cleared",
  "InWarehouse",
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
  blNo: z.string().trim().min(3, "BL No looks too short"),
  supplierId: optionalString,
  customer: optionalString,
  port: optionalString,
  portCode: optionalString,
  item: optionalString,
  variety: optionalString,
  noOfBoxes: optionalInt,
  status: z.enum(CONTAINER_STATUS).default("Booked"),
  etd: optionalDate,
  eta: optionalDate,
  bookingDate: optionalDate,
  freeDays: optionalInt,
  lastFreeDate: optionalDate,
  remarks: optionalString,
});

export const updateContainerSchema = createContainerSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(CONTAINER_STATUS),
});

export type CreateContainerInput = z.input<typeof createContainerSchema>;
export type ContainerStatusValue = (typeof CONTAINER_STATUS)[number];

import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalNum = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, "Warehouse name is required"),
  code: z
    .string()
    .trim()
    .min(1, "Warehouse code is required")
    .transform((v) => v.toUpperCase()),
  city: z.string().trim().min(1, "City is required"),
  state: optionalString,
  address: optionalString,
  storageType: optionalString,
  isColdStorage: z.coerce.boolean().optional().default(true),
  temperatureMinC: optionalNum,
  temperatureMaxC: optionalNum,
  humidityTarget: optionalNum,
  capacityTonnes: optionalNum,
  coldRoomCount: z
    .union([z.coerce.number().int(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v))),
  isActive: z.coerce.boolean().optional().default(true),
});

export const createWarehouseSchema = warehouseSchema;
export const updateWarehouseSchema = warehouseSchema.partial();

export type WarehouseInput = z.input<typeof warehouseSchema>;

import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const coldRoomReadingSchema = z.object({
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  recordedAt: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : new Date())),
  temperatureC: z.coerce.number().min(-30).max(60),
  humidityPct: z.coerce.number().min(0).max(100).optional(),
  source: z.string().trim().default("Manual"),
  notes: optionalString,
});

export const temperatureTaskActionSchema = z.object({
  taskId: z.string().uuid(),
  action: z.enum(["acknowledge", "resolve", "escalate"]),
  resolutionNotes: optionalString,
}).superRefine((value, ctx) => {
  if (value.action === "resolve" && !value.resolutionNotes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["resolutionNotes"],
      message: "Resolution notes are required to resolve a temperature breach",
    });
  }
});

import { z } from "zod";

const UOMS = ["Box", "Kg", "Pallet", "Punnet", "Container", "Carton", "CasePack"] as const;

export const createItemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[A-Za-z0-9-]+$/, "Code may contain letters, digits and hyphens")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  variety: z.string().trim().max(80).optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  hsnCode: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "HSN codes are 4-8 digits")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  defaultUom: z.enum(UOMS).default("Box"),
  packSpec: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const updateItemSchema = createItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

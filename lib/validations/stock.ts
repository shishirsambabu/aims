import { z } from "zod";

export const stockUomSchema = z.enum([
  "Box",
  "Kg",
  "Pallet",
  "Punnet",
  "Container",
  "Carton",
  "CasePack",
]);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

const optionalNum = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

export const stockLotSchema = z.object({
  item: z.string().trim().min(1, "Item is required"),
  variety: optionalString,
  grade: optionalString,
  uom: stockUomSchema,
  qtyReceived: z.coerce.number().positive("Received quantity must be positive"),
  perUnitWeightKg: optionalNum,
  lotNo: optionalString,
  palletNo: optionalString,
  packDate: optionalDate,
  expiryDate: optionalDate,
  bestBeforeDate: optionalDate,
  storageCondition: optionalString,
  ripeningState: optionalString,
  qualityStatus: z.enum(["Released", "QualityHold", "Quarantine", "Rejected"]).optional(),
  temperatureAtReceiptC: optionalNum,
  temperatureBreach: z.coerce.boolean().optional(),
  qualityHoldReason: optionalString,
  locationId: optionalUuid,
});

export const receiveStockSchema = z.object({
  containerId: z.string().uuid("Container is required"),
  warehouseId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  rows: z.array(stockLotSchema).min(1, "Add at least one stock line"),
});

export const stockAdjustmentSchema = z.object({
  stockItemId: z.string().uuid("Stock item is required"),
  action: z.enum(["reserve", "release", "wastage", "dump", "adjust"]),
  qty: z.coerce.number().positive("Quantity must be positive"),
  direction: z.enum(["increase", "decrease"]).optional(),
  reason: optionalString,
  refType: optionalString,
  refId: optionalString,
}).superRefine((value, ctx) => {
  if (value.action === "adjust" && !value.direction) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["direction"],
      message: "Direction is required for manual adjustments",
    });
  }
  if (!value.reason || value.reason.trim().length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "A stock action reason is required",
    });
  }
});

export const stockQualitySchema = z.object({
  stockItemId: z.string().uuid("Stock item is required"),
  action: z.literal("quality"),
  qualityStatus: z.enum(["Released", "QualityHold", "Quarantine", "Rejected"]),
  reason: z.string().trim().min(3, "A quality decision reason is required"),
});

export const stockTransferSchema = z.object({
  stockItemId: z.string().uuid("Stock item is required"),
  action: z.literal("transfer"),
  locationId: z.string().uuid("Destination location is required"),
  reason: z.string().trim().min(3, "A transfer reason is required"),
});

export const stockGradeSplitSchema = z.object({
  item: z.string().trim().optional(),
  variety: optionalString,
  grade: z.string().trim().min(1, "Grade is required"),
  uom: stockUomSchema,
  qtySplit: z.coerce.number().positive("Split quantity must be positive"),
  perUnitWeightKg: optionalNum,
  lotNo: optionalString,
  palletNo: optionalString,
  packDate: optionalDate,
  expiryDate: optionalDate,
  bestBeforeDate: optionalDate,
  storageCondition: optionalString,
  ripeningState: optionalString,
});

export const stockGradeSchema = z.object({
  stockItemId: z.string().uuid("Stock item is required"),
  reason: optionalString,
  rows: z.array(stockGradeSplitSchema).min(1, "Add at least one grade line"),
});

export const gatePassLineSchema = z.object({
  stockItemId: z.string().uuid("Stock item is required"),
  qty: z.coerce.number().positive("Dispatch quantity must be positive"),
});

export const gatePassSchema = z.object({
  warehouseId: z.string().uuid("Warehouse is required"),
  containerId: z.string().uuid().optional(),
  vehicleNo: optionalString,
  driverName: optionalString,
  driverContact: optionalString,
  vehicleSealNo: optionalString,
  loadingPhotoRef: optionalString,
  routeName: optionalString,
  beatName: optionalString,
  deliveryInstructions: optionalString,
  returnCratesPlanned: z.coerce.number().int().min(0).optional(),
  returnPalletsPlanned: z.coerce.number().int().min(0).optional(),
  notes: optionalString,
  exceptionReason: z.string().trim().min(5, "An exception dispatch reason is required").max(500),
  lines: z.array(gatePassLineSchema).min(1, "Add at least one dispatch line"),
});

export const gatePassActionSchema = z
  .object({
    gatePassId: z.string().uuid("Gate pass is required"),
    action: z.enum(["pack", "ready", "fleet", "gate", "pod", "returns", "dispatch", "cancel"]),
    vehicleNo: optionalString,
    driverName: optionalString,
    driverContact: optionalString,
    vehicleSealNo: optionalString,
    loadingPhotoRef: optionalString,
    securityOtp: optionalString,
    podRef: optionalString,
    podAcknowledgedBy: optionalString,
    routeName: optionalString,
    beatName: optionalString,
    deliveryInstructions: optionalString,
    returnCratesPlanned: z.coerce.number().int().min(0).optional(),
    returnCratesReceived: z.coerce.number().int().min(0).optional(),
    returnPalletsPlanned: z.coerce.number().int().min(0).optional(),
    returnPalletsReceived: z.coerce.number().int().min(0).optional(),
    notes: optionalString,
    lineDispatchedQtys: z
      .array(
        z.object({
          lineId: z.string().uuid(),
          qty: z.coerce.number().positive("Quantity must be positive"),
        })
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action !== "fleet") return;
    if (!value.vehicleNo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vehicleNo"],
        message: "Vehicle number is required before dispatch",
      });
    }
    if (!value.driverName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["driverName"],
        message: "Driver name is required before dispatch",
      });
    }
  });

export type ReceiveStockInput = z.input<typeof receiveStockSchema>;
export type StockAdjustmentInput = z.input<typeof stockAdjustmentSchema>;
export type StockTransferInput = z.input<typeof stockTransferSchema>;
export type StockGradeInput = z.input<typeof stockGradeSchema>;
export type GatePassInput = z.input<typeof gatePassSchema>;
export type GatePassActionInput = z.input<typeof gatePassActionSchema>;

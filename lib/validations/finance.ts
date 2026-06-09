import { z } from "zod";

// Accept numbers, numeric strings, or "" (→ undefined) from forms.
const money = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

const qty = z
  .union([z.coerce.number().int(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : Number(v)));

export const costSchema = z.object({
  beInvoiceValueInr: money,
  exchangeRate: money,
  customsDuty: money,
  clearingCharges: money,
  linerCharges: money,
  detention: money,
  chaCharges: money,
  igst: money,
  cess: money,
  transport: money,
  ohProportion: money,
  claimDeduction: money,
  otherCharges: money,
});

export const saleSchema = z.object({
  soldQty: qty,
  avgPrice: money,
  saleValue: money,
  damageQty: qty,
  damageValue: money,
});

export type CostInput = z.infer<typeof costSchema>;
export type SaleInput = z.infer<typeof saleSchema>;

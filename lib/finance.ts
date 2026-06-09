// AIMS finance engine — cost, rate and profit formulas.
// Implemented EXACTLY per agents/finance-engine.md (Aeden's Excel logic).

export interface CostInputs {
  beInvoiceValueInr?: number | null;
  customsDuty?: number | null;
  clearingCharges?: number | null;
  linerCharges?: number | null;
  detention?: number | null;
  chaCharges?: number | null;
  igst?: number | null;
  cess?: number | null;
  transport?: number | null;
  otherCharges?: number | null;
  ohProportion?: number | null;
  claimDeduction?: number | null;
}

export interface CostResult {
  totalCost: number;
  ratePerBoxLanding: number;
  ratePerBox: number; // final
}

export interface SaleInputs {
  saleValue?: number | null;
  damageValue?: number | null;
  soldQty?: number | null;
}

export interface ProfitResult {
  profit: number; // profit per container
  profitPerBox: number | null;
  marginPct: number | null;
}

const n = (v: number | null | undefined): number =>
  v == null || Number.isNaN(v) ? 0 : v;

/**
 * Total Cost = Duty + Clearing + Liner + Detention + CHA + Transport/Other +
 *              BE Invoice Value INR
 * Rate/Box (Landing) = Total Cost / No. of Boxes
 * Rate/Box (Final)   = Rate/Box (Landing) + OH Proportion - Claim Deduction
 */
export function computeCost(
  cost: CostInputs,
  noOfBoxes: number | null | undefined
): CostResult {
  const totalCost =
    n(cost.beInvoiceValueInr) +
    n(cost.customsDuty) +
    n(cost.clearingCharges) +
    n(cost.linerCharges) +
    n(cost.detention) +
    n(cost.chaCharges) +
    n(cost.igst) +
    n(cost.cess) +
    n(cost.transport) +
    n(cost.otherCharges);

  const boxes = n(noOfBoxes);
  const ratePerBoxLanding = boxes > 0 ? totalCost / boxes : 0;
  const ratePerBox =
    ratePerBoxLanding + n(cost.ohProportion) - n(cost.claimDeduction);

  return {
    totalCost: round2(totalCost),
    ratePerBoxLanding: round2(ratePerBoxLanding),
    ratePerBox: round2(ratePerBox),
  };
}

/**
 * Profit Per Container = Sale Value - Damage Value - Total Cost
 * Profit Per Box       = Profit Per Container / Sold Qty
 * Profit Margin %      = (Profit Per Container / Sale Value) × 100
 */
export function computeProfit(
  sale: SaleInputs,
  totalCost: number | null | undefined
): ProfitResult {
  const saleValue = n(sale.saleValue);
  const profit = saleValue - n(sale.damageValue) - n(totalCost);

  const soldQty = n(sale.soldQty);
  const profitPerBox = soldQty > 0 ? round2(profit / soldQty) : null;
  const marginPct = saleValue !== 0 ? round2((profit / saleValue) * 100) : null;

  return { profit: round2(profit), profitPerBox, marginPct };
}

/** Margin colour rule: green > 10%, yellow 0–10%, red < 0%. */
export function marginClass(marginPct: number | null | undefined): string {
  if (marginPct == null || Number.isNaN(marginPct))
    return "text-muted-foreground";
  if (marginPct > 10) return "text-[#2E844A] bg-green-50";
  if (marginPct >= 0) return "text-[#9A6212] bg-yellow-50";
  return "text-[#C23934] bg-red-50";
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

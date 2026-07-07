const RESTRICTED_FINANCIAL_KEYS = new Set([
  "floorPrice",
  "floor_price",
  "costPrice",
  "cost_price",
  "margin",
  "marginPct",
  "margin_pct",
]);

export function redactRestrictedFinancialFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactRestrictedFinancialFields);
  }
  if (!value || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !RESTRICTED_FINANCIAL_KEYS.has(key))
      .map(([key, entry]) => [key, redactRestrictedFinancialFields(entry)])
  );
}

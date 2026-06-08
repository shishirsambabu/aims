// Excel → AIMS field mapping for the existing Aeden tracker sheet.
// Pure module shared by the client wizard (parse/preview) and the API (commit).

export interface MappedRow {
  rowNumber: number;
  // container
  slNo: number | null;
  supplierName: string | null;
  containerNo: string | null;
  customer: string | null;
  port: string | null;
  blNo: string | null;
  item: string | null;
  noOfBoxes: number | null;
  // shipment item
  beNo: string | null;
  beDate: string | null;
  invoiceNo: string | null;
  netWeightKg: number | null;
  invoiceValueUsd: number | null;
  // costs
  beInvoiceValueInr: number | null;
  customsDuty: number | null;
  clearingCharges: number | null;
  linerCharges: number | null;
  detention: number | null;
  chaCharges: number | null;
  transport: number | null;
  ohProportion: number | null;
  claimDeduction: number | null;
  // sales
  soldQty: number | null;
  avgPrice: number | null;
  saleValue: number | null;
  damageQty: number | null;
  damageValue: number | null;
  // payment
  amountRequested: number | null;
  requestDate: string | null;
  // diagnostics
  errors: string[];
}

// Normalised Excel header → canonical MappedRow key.
const HEADER_MAP: Record<string, keyof MappedRow> = {
  slno: "slNo",
  suppliername: "supplierName",
  containerno: "containerNo",
  customer: "customer",
  arrivalport: "port",
  blno: "blNo",
  blnoifpresent: "blNo",
  beno: "beNo",
  bedate: "beDate",
  items: "item",
  item: "item",
  netweightkg: "netWeightKg",
  netweight: "netWeightKg",
  invno: "invoiceNo",
  noofboxes: "noOfBoxes",
  invvalueusd: "invoiceValueUsd",
  invoicevalueusd: "invoiceValueUsd",
  beinvoicevalueinr: "beInvoiceValueInr",
  dutyamount: "customsDuty",
  clearingcharges: "clearingCharges",
  linercharges: "linerCharges",
  detentioncharges: "detention",
  cha: "chaCharges",
  transportationoranyothercharges: "transport",
  ohproportion: "ohProportion",
  claimvaluededuction: "claimDeduction",
  soldqty: "soldQty",
  avgsoldprice: "avgPrice",
  salevalue: "saleValue",
  damageqty: "damageQty",
  damagevalue: "damageValue",
  amountrequested: "amountRequested",
  requesteddate: "requestDate",
};

const NUMERIC_FIELDS = new Set<keyof MappedRow>([
  "slNo", "noOfBoxes", "netWeightKg", "invoiceValueUsd", "beInvoiceValueInr",
  "customsDuty", "clearingCharges", "linerCharges", "detention", "chaCharges",
  "transport", "ohProportion", "claimDeduction", "soldQty", "avgPrice",
  "saleValue", "damageQty", "damageValue", "amountRequested",
]);

const DATE_FIELDS = new Set<keyof MappedRow>(["beDate", "requestDate"]);

function normalize(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(v).trim();
  // Indian day-first formats: DD/MM/YYYY or DD-MM-YY(YY).
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function blankRow(rowNumber: number): MappedRow {
  return {
    rowNumber,
    slNo: null, supplierName: null, containerNo: null, customer: null,
    port: null, blNo: null, item: null, noOfBoxes: null, beNo: null,
    beDate: null, invoiceNo: null, netWeightKg: null, invoiceValueUsd: null,
    beInvoiceValueInr: null, customsDuty: null, clearingCharges: null,
    linerCharges: null, detention: null, chaCharges: null, transport: null,
    ohProportion: null, claimDeduction: null, soldQty: null, avgPrice: null,
    saleValue: null, damageQty: null, damageValue: null, amountRequested: null,
    requestDate: null, errors: [],
  };
}

/** Map a single raw spreadsheet row (header → value) to a MappedRow. */
export function mapRow(
  raw: Record<string, unknown>,
  rowNumber: number
): MappedRow {
  const out = blankRow(rowNumber);

  for (const [header, value] of Object.entries(raw)) {
    const key = HEADER_MAP[normalize(header)];
    if (!key || key === "rowNumber" || key === "errors") continue;
    // Don't let the reserved profit→saleValue alias overwrite a real Sale Value.
    if (key === "saleValue" && out.saleValue != null) continue;

    if (NUMERIC_FIELDS.has(key)) {
      (out[key] as number | null) = toNumber(value);
    } else if (DATE_FIELDS.has(key)) {
      (out[key] as string | null) = toDate(value);
    } else {
      const s = value == null ? null : String(value).trim();
      (out[key] as string | null) = s === "" ? null : s;
    }
  }

  // BL No is optional on import — this tracker keys on Container No; the API
  // defaults BL No to the Container No when the sheet has no BL column.
  if (!out.containerNo) out.errors.push("Missing Container No");

  return out;
}

export function mapRows(raws: Record<string, unknown>[]): MappedRow[] {
  return raws
    .map((r, i) => mapRow(r, i + 2)) // +2: header row is 1, data starts at 2
    .filter(
      (r) =>
        r.containerNo ||
        Object.values(r).some((v) => v != null && v !== "" && v !== r.rowNumber)
    );
}

/* ------------------------------------------------------------------ */
/* Real-world sheet parsing: pick the data sheet, find the header row, */
/* merge two-row headers (grouped columns), then map.                 */
/* ------------------------------------------------------------------ */

function clean(v: unknown): string {
  return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
}

/** Index of the row that contains a "Container No" header (scans top 15). */
export function detectHeaderRow(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const row = aoa[i] ?? [];
    if (row.some((c) => normalize(clean(c)) === "containerno")) return i;
  }
  return 0;
}

/**
 * Build the effective header for each column. When the row below the header is
 * itself a header (grouped columns like "PAYMENT UPDATIONS" → "Amount
 * Requested"), the more specific sub-label wins.
 */
function buildHeaders(aoa: unknown[][], hdr: number): string[] {
  const top = aoa[hdr] ?? [];
  const sub = aoa[hdr + 1] ?? [];

  const containerCol = top.findIndex(
    (c) => normalize(clean(c)) === "containerno"
  );
  // If the next row has a value in the Container-No column, it's data, not a
  // secondary header.
  const secondIsHeader =
    containerCol >= 0 && clean(sub[containerCol]) === "";

  const width = Math.max(top.length, sub.length);
  const headers: string[] = [];
  for (let c = 0; c < width; c++) {
    headers[c] = secondIsHeader
      ? clean(sub[c]) || clean(top[c])
      : clean(top[c]);
  }
  return headers;
}

/** Parse a sheet (array-of-arrays) into mapped, filtered rows. */
export function mapSheetRows(aoa: unknown[][]): MappedRow[] {
  const hdr = detectHeaderRow(aoa);
  const headers = buildHeaders(aoa, hdr);
  const containerCol = (aoa[hdr] ?? []).findIndex(
    (c) => normalize(clean(c)) === "containerno"
  );
  const secondIsHeader =
    containerCol >= 0 && clean((aoa[hdr + 1] ?? [])[containerCol]) === "";
  const firstDataRow = hdr + (secondIsHeader ? 2 : 1);

  const out: MappedRow[] = [];
  for (let r = firstDataRow; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const raw: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      raw[h] = row[c] ?? null;
    }
    const mapped = mapRow(raw, r + 1);
    if (mapped.containerNo) out.push(mapped);
  }
  return out;
}

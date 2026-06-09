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
  pol: string | null;
  origin: string | null;
  line: string | null;
  vessel: string | null;
  transhipment: string | null;
  blNo: string | null;
  item: string | null;
  packageType: string | null;
  perPackageWeight: number | null;
  noOfBoxes: number | null;
  transitTime: number | null;
  etd: string | null;
  eta: string | null;
  doUpto: string | null;
  emptyReturnDate: string | null;
  freeDays: number | null;
  // shipment item
  beNo: string | null;
  beDate: string | null;
  invoiceNo: string | null;
  packingListNo: string | null;
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
  cntno: "containerNo",
  customer: "customer",
  consignee: "customer",
  arrivalport: "port",
  pol: "pol",
  origin: "origin",
  line: "line",
  vesselandvoyage: "vessel",
  vessel: "vessel",
  transhipment: "transhipment",
  blno: "blNo",
  blnoifpresent: "blNo",
  beno: "beNo",
  be: "beNo",
  bedate: "beDate",
  items: "item",
  item: "item",
  freedays: "freeDays",
  doupto: "doUpto",
  do: "doUpto",
  emptyreturn: "emptyReturnDate",
  transittime: "transitTime",
  etd: "etd",
  eta: "eta",
  changedeta: "eta",
  netweightkg: "netWeightKg",
  netweight: "netWeightKg",
  invno: "invoiceNo",
  invoiceno: "invoiceNo",
  noofboxes: "noOfBoxes",
  duty: "customsDuty",
  detention: "detention",
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
  "perPackageWeight", "transitTime", "freeDays",
]);

const DATE_FIELDS = new Set<keyof MappedRow>([
  "beDate", "requestDate", "etd", "eta", "doUpto", "emptyReturnDate",
]);

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
    port: null, pol: null, origin: null, line: null, vessel: null,
    transhipment: null, blNo: null, item: null, packageType: null,
    perPackageWeight: null, noOfBoxes: null, transitTime: null, etd: null,
    eta: null, doUpto: null, emptyReturnDate: null, freeDays: null,
    beNo: null, beDate: null, invoiceNo: null, packingListNo: null,
    netWeightKg: null, invoiceValueUsd: null,
    beInvoiceValueInr: null, customsDuty: null, clearingCharges: null,
    linerCharges: null, detention: null, chaCharges: null, transport: null,
    ohProportion: null, claimDeduction: null, soldQty: null, avgPrice: null,
    saleValue: null, damageQty: null, damageValue: null, amountRequested: null,
    requestDate: null, errors: [],
  };
}

/**
 * Parse the arrival sheet's "weight / boxes" cell — e.g. "13 KG / 1494 BOXES"
 * or "10.712 KG / 2240 CARTONS" — into per-package weight, box count and type.
 */
function parseWeightBoxes(v: unknown): {
  perPackageWeight: number | null;
  noOfBoxes: number | null;
  packageType: string | null;
} {
  const s = String(v ?? "").trim();
  if (!s) return { perPackageWeight: null, noOfBoxes: null, packageType: null };
  const nums = s.match(/[\d.]+/g) ?? [];
  const w = nums[0] ? Number(nums[0]) : null;
  const boxes = nums[1] ? Math.round(Number(nums[1])) : null;
  const typeMatch = s.match(/(boxes|cartons?|cases?|bags?|wooden|crates?)/i);
  return {
    perPackageWeight: w != null && !Number.isNaN(w) ? w : null,
    noOfBoxes: boxes != null && !Number.isNaN(boxes) ? boxes : null,
    packageType: typeMatch ? typeMatch[1].toUpperCase() : null,
  };
}

/** Map a single raw spreadsheet row (header → value) to a MappedRow. */
export function mapRow(
  raw: Record<string, unknown>,
  rowNumber: number
): MappedRow {
  const out = blankRow(rowNumber);

  for (const [header, value] of Object.entries(raw)) {
    const norm = normalize(header);
    // Arrival sheet packs weight + box count + type into one cell.
    if (norm === "weightboxes" || (norm.startsWith("weight") && norm.includes("box"))) {
      const wb = parseWeightBoxes(value);
      if (wb.perPackageWeight != null) out.perPackageWeight = wb.perPackageWeight;
      if (wb.noOfBoxes != null) out.noOfBoxes = wb.noOfBoxes;
      if (wb.packageType) out.packageType = wb.packageType;
      continue;
    }
    const key = HEADER_MAP[norm];
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

function isContainerCol(c: unknown): boolean {
  const n = normalize(clean(c));
  return n === "containerno" || n === "cntno";
}

/** Index of the row that contains a "Container No" header (scans top 15). */
export function detectHeaderRow(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const row = aoa[i] ?? [];
    if (row.some((c) => isContainerCol(c))) return i;
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
    (c) => isContainerCol(c)
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
    (c) => isContainerCol(c)
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

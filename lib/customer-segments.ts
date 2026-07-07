export const CUSTOMER_CLASSES = [
  "Wholesaler",
  "Retailer",
  "Modern Retail",
  "HORECA",
  "Distributor",
  "Institutional",
  "Online / Quick Commerce",
  "Processor",
  "Interstate Trader",
] as const;

export type CustomerClass = (typeof CUSTOMER_CLASSES)[number];

export const CUSTOMER_CLASS_DESCRIPTIONS: Record<CustomerClass, string> = {
  Wholesaler: "High-volume mandi, market, and resale buyers who usually move full lots fast.",
  Retailer: "Independent fruit stores and smaller retail outlets with regular mixed orders.",
  "Modern Retail": "Supermarkets and organized retail chains with stricter documentation and delivery windows.",
  HORECA: "Hotels, restaurants, caterers, and food-service buyers needing predictable grades and pack sizes.",
  Distributor: "Regional distribution accounts that resell into their own networks.",
  Institutional: "Corporate, campus, hospital, and large institutional buying accounts.",
  "Online / Quick Commerce": "E-commerce or quick-commerce channels with strict SLA and packaging expectations.",
  Processor: "Juice, cut-fruit, bakery, or processing buyers that can accept processing-grade stock.",
  "Interstate Trader": "Outstation buyers with higher logistics, credit, and dispatch coordination risk.",
};

export const CUSTOMER_ONBOARDING_REQUIREMENTS: Record<CustomerClass, string[]> = {
  Wholesaler: [
    "GSTIN and PAN verified against billing name",
    "Credit limit approved by finance before first dispatch",
    "Primary buyer and accounts contact captured",
    "Expected market, preferred fruit category, and usual lot size noted",
  ],
  Retailer: [
    "GSTIN/PAN or prepaid-only approval captured",
    "Shop delivery address and receiving hours confirmed",
    "Payment terms and collection owner assigned",
    "Preferred grade, pack size, and rejection rules documented",
  ],
  "Modern Retail": [
    "Vendor onboarding documents uploaded",
    "PO, invoice, E-way, and delivery appointment SOP confirmed",
    "Store/DC ship-to mapping completed",
    "Quality rejection and debit-note escalation owner assigned",
  ],
  HORECA: [
    "Kitchen/contact and accounts contact captured",
    "Standing order pattern and delivery cut-off agreed",
    "Grade, ripeness, and substitute acceptance noted",
    "Payment terms and dispute owner assigned",
  ],
  Distributor: [
    "Territory and route ownership confirmed",
    "Credit exposure and downstream payment cycle reviewed",
    "Dispatch vehicle/loading preference captured",
    "Sales rep and collection escalation owner assigned",
  ],
  Institutional: [
    "PO process and authorized signatory captured",
    "Contract rate or day-price dependency documented",
    "Invoice submission portal/email confirmed",
    "Credit review cadence set with finance",
  ],
  "Online / Quick Commerce": [
    "SKU, barcode, pack, and SLA expectations documented",
    "Rejection, return, and credit-note workflow agreed",
    "Delivery slot and DC mapping completed",
    "Daily pricing and availability confirmation owner assigned",
  ],
  Processor: [
    "Processing-grade acceptance criteria documented",
    "Wastage/rejection tolerance agreed",
    "Lot traceability and food-safety documents captured",
    "Payment and pickup schedule confirmed",
  ],
  "Interstate Trader": [
    "Transport responsibility and delivery risk documented",
    "Advance/credit rules approved by finance",
    "State/E-way requirements confirmed",
    "Dispatch proof and claims window agreed",
  ],
};

export function isCustomerClass(value: unknown): value is CustomerClass {
  return typeof value === "string" && CUSTOMER_CLASSES.includes(value as CustomerClass);
}

export function normalizeCustomerClass(value: string | null | undefined): CustomerClass | null {
  if (!value) return null;
  const match = CUSTOMER_CLASSES.find((entry) => entry.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}

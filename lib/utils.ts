import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an INR amount using the Indian numbering system (₹1,23,45,678). */
export function formatINR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a USD amount ($12,345.67). */
export function formatUSD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format an AED amount. */
export function formatAED(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format an amount in the given currency (USD, AED or INR). */
export function formatMoney(
  value: number | null | undefined,
  currency: "USD" | "AED" | "INR"
): string {
  if (currency === "INR") return formatINR(value);
  if (currency === "USD") return formatUSD(value);
  return formatAED(value);
}

/** Profit margin colour rule: green > 10%, yellow 0–10%, red < 0%. */
export function marginColor(marginPct: number | null | undefined): string {
  if (marginPct == null || Number.isNaN(marginPct)) return "text-muted-foreground";
  if (marginPct > 10) return "text-success";
  if (marginPct >= 0) return "text-warning";
  return "text-danger";
}

/** Days until expiry (negative if already expired); null when no date. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export type ExpiryLevel = "expired" | "critical" | "warning" | "ok" | "none";

/** Expiry banding: expired, critical (≤7d), warning (≤30d), ok, or none. */
export function expiryLevel(
  value: string | Date | null | undefined
): ExpiryLevel {
  const days = daysUntil(value);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 7) return "critical";
  if (days <= 30) return "warning";
  return "ok";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

import { Ship, Package, FileCheck2, TrendingUp } from "lucide-react";

import {
  BRAND_COMPANY_NAME,
  BRAND_FULL_NAME,
  BRAND_LOCATION,
  BRAND_SHORT_NAME,
  BRAND_TAGLINE,
} from "@/lib/branding";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Ship className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-heading text-lg font-bold">{BRAND_SHORT_NAME}</p>
            <p className="text-xs text-white/55">{BRAND_FULL_NAME}</p>
          </div>
        </div>

        <div className="max-w-md space-y-5">
          <h1 className="font-heading text-3xl font-bold leading-tight">
            Every container, costed and tracked from booking to fully sold.
          </h1>
          <p className="text-sm text-white/60">{BRAND_TAGLINE}</p>
          <ul className="space-y-2.5 pt-2">
            {[
              { icon: Package, text: "Live container & shipment tracking" },
              { icon: FileCheck2, text: "Documentation, customs & compliance" },
              { icon: TrendingUp, text: "Landed cost & real-time profit" },
            ].map((f) => (
              <li
                key={f.text}
                className="flex items-center gap-3 text-sm text-white/80"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10">
                  <f.icon className="h-3.5 w-3.5 text-sky-300" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/40">
          Copyright {new Date().getFullYear()} {BRAND_COMPANY_NAME}
          {" | "}
          {BRAND_LOCATION}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-card lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          {children}
        </div>
      </div>
    </div>
  );
}

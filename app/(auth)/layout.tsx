import { Ship, Package, FileCheck2, TrendingUp } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0B1530] p-12 text-white lg:flex">
        {/* Gradient mesh + glow orbs */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0B1530] via-[#10224B] to-[#0B1530]" />
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-primary/30 blur-[100px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-violet-500/20 blur-[100px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sky-400 shadow-lg shadow-primary/30">
            <Ship className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <p className="heading-caps text-lg">AIMS</p>
            <p className="text-xs text-white/50">Aeden Imports Management System</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="font-heading text-4xl font-bold leading-[1.15]">
            Every container,{" "}
            <span className="bg-gradient-to-r from-sky-300 to-primary bg-clip-text text-transparent">
              costed and tracked
            </span>{" "}
            — from booking to fully sold.
          </h1>
          <p className="text-white/60">
            The enterprise workspace for Aeden Fruits International — imports,
            landing costs, documentation and profit, in one place.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              { icon: Package, text: "Live container & shipment tracking" },
              { icon: FileCheck2, text: "Documentation, customs & compliance" },
              { icon: TrendingUp, text: "Landed cost & real-time profit" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4 text-sky-300" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} Aeden Fruits International Pvt Ltd ·
          Kochi, Kerala
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-background p-6">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-card lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          {children}
        </div>
      </div>
    </div>
  );
}

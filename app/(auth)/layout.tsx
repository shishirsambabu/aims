import { Ship } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Ship className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold leading-tight">AIMS</p>
            <p className="text-xs text-sidebar-muted">Aeden Import Management</p>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="font-heading text-3xl font-bold leading-tight">
            Every container, costed and tracked — from booking to fully sold.
          </h1>
          <p className="text-sidebar-muted">
            Track imports, landing costs, documentation and profit in one
            enterprise workspace built for Aeden Fruits International.
          </p>
        </div>

        <p className="text-xs text-sidebar-muted">
          © {new Date().getFullYear()} Aeden Fruits International Pvt Ltd ·
          Kochi, Kerala
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

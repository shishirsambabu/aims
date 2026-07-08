import Link from "next/link";
import {
  Coins,
  FileSpreadsheet,
  Users,
  Database,
  History,
  ArrowRight,
  Bot,
  Plug,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/settings/suppliers",
    title: "Master Data",
    description:
      "Manage suppliers (add/edit/delete) and reference data — ports and customers.",
    icon: Database,
  },
  {
    href: "/settings/items",
    title: "Items / Products",
    description:
      "The item master: codes, varieties, grades, HSN codes and default UoM used across stock, pricing and invoices.",
    icon: Database,
  },
  {
    href: "/settings/warehouses",
    title: "Warehouses",
    description:
      "Create cold stores, define capacity and temperature bands, and assign containers.",
    icon: Database,
  },
  {
    href: "/customers",
    title: "Customers / CRM",
    description:
      "Onboard buyers, manage KYC, assign reps and control credit exposure.",
    icon: Users,
  },
  {
    href: "/orders",
    title: "Sales Orders",
    description:
      "Publish day prices, reserve stock, and review order approval flow.",
    icon: FileSpreadsheet,
  },
  {
    href: "/receipts",
    title: "Receipts / AR",
    description:
      "Record customer collections, allocate them to orders, and manage overdue receivables.",
    icon: Coins,
  },
  {
    href: "/settings/import",
    title: "Excel Import",
    description:
      "Bulk-load your existing tracker sheet — auto column mapping, duplicate detection, preview before commit.",
    icon: FileSpreadsheet,
  },
  {
    href: "/settings/document-automation",
    title: "Document Automation",
    description:
      "Dossier ZIPs, image compression, email-to-document intake and OCR review workflows.",
    icon: Bot,
  },
  {
    href: "/settings/integrations",
    title: "Integrations",
    description:
      "Provider setup for Outlook, Tally, ICEGATE, carriers and OCR syncs.",
    icon: Plug,
  },
  {
    href: "/settings/team",
    title: "Team Management",
    description:
      "Invite members and manage roles (admin / gm / manager / sales / warehouse / finance / viewer / auditor).",
    icon: Users,
  },
  {
    href: "/settings/flags",
    title: "Feature Flags",
    description:
      "Kill switches and staged rollouts, including the maintenance-mode banner (admins).",
    icon: Plug,
  },
  {
    href: "/settings/security",
    title: "Security / MFA",
    description:
      "Two-factor authentication with an authenticator app — enroll before MFA enforcement is switched on.",
    icon: Users,
  },
  {
    href: "/settings/audit",
    title: "Audit Log",
    description:
      "Immutable trail of every change — who did what, and when (admins, managers, auditors).",
    icon: History,
  },
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Data import, team management and workspace configuration."
      />
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="rounded-md bg-surface-alt p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

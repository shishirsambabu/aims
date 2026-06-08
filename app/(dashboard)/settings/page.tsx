import Link from "next/link";
import { FileSpreadsheet, Users, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/settings/import",
    title: "Excel Import",
    description:
      "Bulk-load your existing tracker sheet — auto column mapping, duplicate detection, preview before commit.",
    icon: FileSpreadsheet,
  },
  {
    href: "/settings/team",
    title: "Team Management",
    description:
      "Invite members and manage roles (admin / manager / viewer).",
    icon: Users,
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

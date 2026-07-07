import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Truck,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ProcurementModulePage() {
  return (
    <div>
      <PageHeader
        title="Procurement"
        description="A core function for supplier sourcing, purchase planning, and inbound control."
        actions={
          <Button asChild variant="outline">
            <Link href="/">
              Back to hub <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <Card className="command-surface rounded-[1.5rem]">
          <CardContent className="grid gap-4 p-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6212]">
                Core function
              </div>
              <h2 className="font-heading text-2xl font-bold">
                Procurement will become the sourcing control room
              </h2>
              <p className="text-sm text-muted-foreground">
                This module will manage supplier onboarding, negotiation, purchase
                planning, and inbound planning tied to stock and forecasts.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickStat label="Suppliers" value="Planned" />
              <QuickStat label="Purchase plan" value="Planned" />
              <QuickStat label="Approvals" value="Planned" />
              <QuickStat label="Inbound sync" value="Planned" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={Users2}
            title="Supplier master"
            text="Store supplier profiles, contracts, contacts, and rating history."
          />
          <Feature
            icon={BriefcaseBusiness}
            title="Purchase planning"
            text="Plan buying by demand, shortages, landed cost, and available slots."
          />
          <Feature
            icon={Truck}
            title="Inbound coordination"
            text="Connect the purchase plan to shipping, ETA tracking, and receiving."
          />
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface px-4 py-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-heading text-lg font-semibold">{value}</p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <Card className="rounded-[1.35rem]">
      <CardContent className="p-6">
        <div className="rounded-2xl bg-warning/10 p-3 text-[#9A6212] ring-1 ring-warning/15">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-heading text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

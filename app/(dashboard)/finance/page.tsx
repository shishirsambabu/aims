import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  Calculator,
  Landmark,
  Receipt,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FinanceControlsWorkspace } from "@/components/finance/FinanceControlsWorkspace";
import { FinanceDocumentsWorkspace } from "@/components/finance/FinanceDocumentsWorkspace";
import { requireSession } from "@/lib/auth";
import { getFinanceDocumentWorkspace } from "@/lib/data/finance-documents";
import { getFinanceControlWorkspace } from "@/lib/data/finance-controls";
import { can } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/page-access";

const financeTiles = [
  {
    title: "Receipts",
    href: "/receipts",
    icon: Receipt,
    description: "Record collections and match receipts to open customer balances.",
  },
  {
    title: "Payments",
    href: "/payments",
    icon: Banknote,
    description: "Track payable status, approvals, and settlement timing.",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: Calculator,
    description: "Review margin, ageing, cash flow, and management reports.",
  },
  {
    title: "Governance",
    href: "/settings",
    icon: ShieldCheck,
    description: "Control finance permissions, approvals, and role-based visibility.",
  },
] as const;

export default async function FinanceModulePage() {
  const session = await requireSession();
  requirePageAccess(session.role, ["financials.view", "receipts.view"]);
  const [financeDocuments, financeControls] = await Promise.all([
    getFinanceDocumentWorkspace(session.orgId),
    getFinanceControlWorkspace(session.orgId),
  ]);

  return (
    <div>
      <PageHeader
        title="Finance Module"
        description="Collections, payables, controls, and profitability views for the ERP."
        actions={
          <Button asChild>
            <Link href="/receipts">
              Open receipts <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <Card className="command-surface rounded-[1.5rem]">
          <CardContent className="grid gap-4 p-6 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Money control
              </div>
              <h2 className="font-heading text-2xl font-bold">
                Visibility across receivables, payables, and margin
              </h2>
              <p className="text-sm text-muted-foreground">
                This page groups the finance workbench so the team can move from
                customer collection to supplier settlement without losing control.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickStat label="Receivables" value="Live" />
              <QuickStat label="Payables" value="Live" />
              <QuickStat label="Margin" value="Live" />
              <QuickStat label="Controls" value="Live" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {financeTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.title}
                href={tile.href}
                className="group rounded-[1.35rem] border border-border/70 bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary ring-1 ring-primary/15">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold">
                  {tile.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {tile.description}
                </p>
                <p className="mt-4 text-sm font-semibold text-primary">Open {tile.title}</p>
              </Link>
            );
          })}
        </div>

        <Card className="rounded-[1.35rem]">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-lg font-semibold">
                Finance submodules
              </h3>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Pill>Accounts receivable</Pill>
              <Pill>Accounts payable</Pill>
              <Pill>Receipt allocation</Pill>
              <Pill>Outstanding exposure</Pill>
              <Pill>Margin and profit views</Pill>
              <Pill>Approval controls</Pill>
            </div>
          </CardContent>
        </Card>

        <FinanceDocumentsWorkspace
          data={JSON.parse(JSON.stringify(financeDocuments))}
          canIssueInvoice={can(session.role, "invoice.issue")}
          canIssueCreditNote={can(session.role, "creditnote.issue")}
          canPostReturn={can(session.role, "return.post")}
        />

        <FinanceControlsWorkspace
          data={JSON.parse(JSON.stringify(financeControls))}
          canReconcile={can(session.role, "bank.reconcile")}
          canPostJournal={can(session.role, "journal.post")}
          canClose={can(session.role, "finance.close")}
          canManageDisputes={can(session.role, "dispute.manage")}
        />
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

function Pill({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-foreground">
      {children}
    </div>
  );
}

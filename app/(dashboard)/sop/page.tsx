import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { SOP_PLAYBOOKS } from "@/lib/sop";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SopPage() {
  await requireSession();

  const modules = Array.from(new Set(SOP_PLAYBOOKS.map((playbook) => playbook.module)));

  return (
    <div>
      <PageHeader
        title="SOP Center"
        description="Imported-fruit cold-storage operating playbooks for CRM, inward, grading, repacking, outward, credit control, and import documentation."
      />

      <div className="space-y-6 p-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-300 bg-slate-950 text-white shadow-card">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative p-6 md:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.34),transparent_22rem),radial-gradient(circle_at_85%_20%,rgba(245,158,11,0.24),transparent_18rem)]" />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                  Aeden cold-storage operating system
                </p>
                <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight">
                  SOPs should tell the next user what to do next.
                </h2>
                <p className="mt-4 text-sm leading-6 text-slate-200">
                  Each playbook maps trigger, stakeholders, ERP handoff, controls,
                  and exit gate. The goal is not documentation theatre; it is making
                  inward, grading, repacking, outward, and credit work move from one
                  owner to the next without WhatsApp chaos.
                </p>
              </div>
            </div>
            <div className="grid gap-3 border-t border-white/10 bg-white/[0.06] p-5 md:grid-cols-2 lg:border-l lg:border-t-0">
              {modules.map((module) => (
                <div key={module} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{module}</p>
                  <p className="mt-2 font-financial text-3xl font-bold">
                    {SOP_PLAYBOOKS.filter((playbook) => playbook.module === module).length}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">linked playbooks</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          {SOP_PLAYBOOKS.map((playbook) => {
            const Icon = playbook.icon;
            return (
              <Card key={playbook.id} className="overflow-hidden rounded-[1.5rem] border-slate-300 shadow-card">
                <div
                  className={cn(
                    "h-2",
                    playbook.module === "Warehouse"
                      ? "bg-emerald-500"
                      : playbook.module === "CRM"
                        ? "bg-sky-500"
                        : playbook.module === "Sales"
                          ? "bg-amber-500"
                          : playbook.module === "Finance"
                            ? "bg-lime-600"
                            : "bg-blue-600"
                  )}
                />
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-border bg-primary/10 p-3 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <Badge variant="outline">{playbook.module}</Badge>
                        <h2 className="mt-2 font-heading text-xl font-semibold">
                          {playbook.title}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {playbook.purpose}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={playbook.erpHref}>
                        Open ERP workspace <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoBlock label="Trigger" value={playbook.trigger} />
                    <InfoBlock label="Stakeholders" value={playbook.stakeholders.join(" -> ")} />
                    <InfoBlock label="Exit Gate" value={playbook.exitGate} />
                  </div>

                  <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Handoff
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-muted-foreground">
                      {playbook.handoff}
                    </p>
                  </div>

                  <div>
                    <p className="label-caps">ERP workflow steps</p>
                    <div className="relative mt-3 space-y-3">
                      <div className="absolute bottom-4 left-[13px] top-4 w-px bg-border" />
                      {playbook.steps.map((step, index) => (
                        <div key={step.title} className="relative rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 dark:border-border dark:bg-surface">
                          <div className="flex items-start gap-3">
                            <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium">{step.title}</p>
                              <p className="mt-1 text-sm font-medium text-slate-600 dark:text-muted-foreground">
                                Owner: {step.owner}
                              </p>
                              <p className="mt-2 text-sm">{step.systemAction}</p>
                              <p className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 dark:border-border dark:bg-background/70 dark:text-muted-foreground">
                                Control: {step.control}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label-caps">Guardrails</p>
                    <div className="mt-3 grid gap-2">
                      {playbook.guardrails.map((guardrail) => (
                        <div key={guardrail} className="rounded-xl border border-border bg-background/70 px-3 py-2 text-sm">
                          {guardrail}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 dark:border-border dark:bg-surface">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm text-slate-900 dark:text-foreground">{value}</p>
    </div>
  );
}

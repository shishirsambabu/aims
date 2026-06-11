import { Bot, CheckCircle2, KeyRound, Lock, Mail, ScanText } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentAutomationPage() {
  const session = await requireSession();
  const canView = can(session.role, "doc.verify") || session.role === "admin";

  const jobs = canView
    ? await prisma.documentAutomationJob.findMany({
        where: { orgId: session.orgId },
        orderBy: { createdAt: "desc" },
        take: 25,
      })
    : [];

  const pending = jobs.filter((j) => j.reviewStatus === "PendingReview").length;
  const failed = jobs.filter((j) => j.status === "Failed").length;

  return (
    <div>
      <PageHeader
        title="Document Automation"
        description="Compressed uploads, container dossier ZIPs, email-to-document intake and OCR review."
      />
      <div className="space-y-6 p-6">
        {!canView ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={Lock}
                title="Automation queue is restricted"
                description="Only document verifiers, managers and admins can access email/OCR automation jobs."
                className="border-0 bg-transparent"
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatusCard
                label="Queued / Recent Jobs"
                value={jobs.length}
                icon={Bot}
              />
              <StatusCard
                label="Pending Review"
                value={pending}
                icon={ScanText}
              />
              <StatusCard
                label="Failed"
                value={failed}
                icon={KeyRound}
                danger={failed > 0}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Capability
                icon={CheckCircle2}
                title="Dossier ZIP"
                status="Live"
                description="Available from each container's Documents tab."
              />
              <Capability
                icon={CheckCircle2}
                title="Image Compression"
                status="Live"
                description="Large JPG/PNG uploads are compressed before storage."
              />
              <Capability
                icon={Mail}
                title="Email + OCR Providers"
                status="Setup pending"
                description="The review queue is ready; Outlook and OCR credentials still need to be connected."
              />
            </div>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-heading text-base font-semibold">
                  Automation Queue
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Email/OCR jobs will land here for human review before they
                  update operational records.
                </p>
                {jobs.length === 0 ? (
                  <EmptyState
                    icon={Mail}
                    title="No automation jobs yet"
                    description="This is expected until Outlook/email and OCR provider keys are connected. Manual uploads and dossier ZIPs are already live."
                    className="mt-6"
                  />
                ) : (
                  <ul className="mt-4 divide-y divide-border">
                    {jobs.map((job) => (
                      <li
                        key={job.id}
                        className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {job.fileName ?? job.subject ?? job.source}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {job.source} - {job.status} - {job.reviewStatus}
                          </p>
                        </div>
                        <p className="font-financial text-xs text-muted-foreground">
                          {formatDate(job.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  icon: Icon,
  danger,
}: {
  label: string;
  value: number;
  icon: typeof Bot;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? "border-danger/30 bg-danger/5" : undefined}>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <p className="label-caps">{label}</p>
          <p className={danger ? "font-financial mt-1 text-3xl font-bold text-danger" : "font-financial mt-1 text-3xl font-bold"}>
            {value}
          </p>
        </div>
        <div className={danger ? "rounded-xl bg-danger/10 p-3 text-danger" : "rounded-xl bg-primary/10 p-3 text-primary"}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function Capability({
  icon: Icon,
  title,
  status,
  description,
}: {
  icon: typeof Bot;
  title: string;
  status: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading font-semibold">{title}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              {status}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

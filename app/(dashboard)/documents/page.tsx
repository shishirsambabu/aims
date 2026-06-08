import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { DocumentFilters } from "@/components/documents/DocumentFilters";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { requireSession, canWrite } from "@/lib/auth";
import {
  listDocuments,
  containerOptions,
  type DocumentRow,
} from "@/lib/data/documents";
import type { DocumentStatus, DocumentType } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    q?: string;
    type?: string;
    status?: string;
    containerId?: string;
    expiringSoon?: string;
  };
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const editable = canWrite(session.role);

  let rows: DocumentRow[] = [];
  let containers: Awaited<ReturnType<typeof containerOptions>> = [];
  let loadError = false;

  try {
    [rows, containers] = await Promise.all([
      listDocuments(session.orgId, {
        q: searchParams.q,
        type: searchParams.type as DocumentType | undefined,
        status: searchParams.status as DocumentStatus | undefined,
        containerId: searchParams.containerId,
        expiringSoon: searchParams.expiringSoon === "1",
      }),
      containerOptions(session.orgId),
    ]);
  } catch (err) {
    console.error("[documents/page] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Bills of lading, invoices, certificates — linked to every container by Container No and BL No."
        actions={
          editable && (
            <DocumentUpload orgId={session.orgId} containers={containers} />
          )
        }
      />

      <div className="space-y-4 p-6">
        <DocumentFilters />

        {loadError ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6212]" />
            <div>
              <p className="font-medium">Couldn&apos;t load documents</p>
              <p className="text-muted-foreground">
                The database isn&apos;t reachable from this environment. Set a
                reachable <code>DATABASE_URL</code> and apply migrations.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {rows.length} document{rows.length === 1 ? "" : "s"}
            </p>
            <DocumentsTable data={rows} canEdit={editable} />
          </>
        )}
      </div>
    </div>
  );
}

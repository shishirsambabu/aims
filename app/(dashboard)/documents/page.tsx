import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { DocumentFilters } from "@/components/documents/DocumentFilters";
import { DocumentsExportButton } from "@/components/documents/DocumentsExportButton";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  listDocuments,
  countDocuments,
  containerOptions,
  type DocumentRow,
} from "@/lib/data/documents";
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination";
import { PaginationBar } from "@/components/ui/pagination-bar";
import type { DocumentStatus, DocumentType } from "@/types";
import { requirePageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    containerId?: string;
    expiringSoon?: string;
    page?: string;
  }>;
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await requireSession();
  requirePageAccess(session.role, ["doc.view"]);
  const editable = can(session.role, "doc.write");
  const page = parsePage(params.page);
  const filters = {
    q: params.q,
    type: params.type as DocumentType | undefined,
    status: params.status as DocumentStatus | undefined,
    containerId: params.containerId,
    expiringSoon: params.expiringSoon === "1",
  };

  let rows: DocumentRow[] = [];
  let total = 0;
  let containers: Awaited<ReturnType<typeof containerOptions>> = [];
  let loadError = false;

  try {
    [rows, total, containers] = await Promise.all([
      listDocuments(session.orgId, filters, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      }),
      countDocuments(session.orgId, filters),
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
          <div className="flex items-center gap-2">
            <DocumentsExportButton total={total} />
            {editable && (
              <DocumentUpload orgId={session.orgId} containers={containers} />
            )}
          </div>
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
            <DocumentsTable data={rows} canEdit={editable} />
            <PaginationBar total={total} page={page} itemLabel="documents" />
          </>
        )}
      </div>
    </div>
  );
}

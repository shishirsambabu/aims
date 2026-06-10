import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getReportData } from "@/lib/data/reports";
import {
  reportToPdfBuffer,
  reportToCsv,
  reportToWorkbook,
  workbookToBuffer,
} from "@/lib/exports/reports";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json(
        { error: "You do not have access to financial exports" },
        { status: 403 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const requestedFormat = sp.get("format");
    const format =
      requestedFormat === "csv" || requestedFormat === "pdf"
        ? requestedFormat
        : "xlsx";
    const filters = {
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    };

    const data = await getReportData(session.orgId, filters);

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "exported_management_report",
      entityType: "report",
      entityId: null,
      summary: `Exported management report (${format.toUpperCase()})`,
      metadata: filters,
    });

    if (format === "csv") {
      const csv = reportToCsv(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="AIMS-management-report-${stamp()}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "pdf") {
      const pdf = await reportToPdfBuffer(data);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="AIMS-management-report-${stamp()}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = workbookToBuffer(reportToWorkbook(data));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="AIMS-management-report-${stamp()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/reports/management]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

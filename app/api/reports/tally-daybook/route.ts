import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { reportError } from "@/lib/observability";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view") && !can(session.role, "audit.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const entries = await prisma.journalEntry.findMany({
      where: {
        orgId: session.orgId,
        status: "Posted",
        entryDate: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ entryDate: "asc" }, { entryNo: "asc" }],
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });

    const header = [
      "Date",
      "Voucher No",
      "Source Type",
      "Source ID",
      "Narration",
      "Account Code",
      "Account Name",
      "Debit",
      "Credit",
    ];
    const rows = [csvRow(header)];
    for (const entry of entries) {
      for (const line of entry.lines) {
        rows.push(
          csvRow([
            entry.entryDate.toISOString().slice(0, 10),
            entry.entryNo,
            entry.sourceType,
            entry.sourceId,
            entry.narration,
            line.accountCode,
            line.accountName,
            Number(line.debitAmount).toFixed(2),
            Number(line.creditAmount).toFixed(2),
          ])
        );
      }
    }

    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aims-tally-daybook-${fromDate.toISOString().slice(0, 10)}-${toDate.toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await reportError(err, { route: "reports/tally-daybook", method: "GET" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

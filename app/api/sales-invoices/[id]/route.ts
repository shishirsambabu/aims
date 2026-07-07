import { NextResponse, type NextRequest } from "next/server";

import { cancelFinanceDocument, FinanceDocumentError } from "@/lib/data/finance-documents";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { financeDocumentCancelSchema } from "@/lib/validations/finance-documents";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    if (!can(session.role, "invoice.issue")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const parsed = financeDocumentCancelSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const { id } = await context.params;
    const invoice = await cancelFinanceDocument(
      session.orgId,
      session.userId,
      "invoice",
      id,
      parsed.data.reason
    );
    return NextResponse.json({ data: invoice });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (err instanceof FinanceDocumentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/sales-invoices/[id] PATCH]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

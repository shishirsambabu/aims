import { NextResponse, type NextRequest } from "next/server";

import {
  FinanceDocumentError,
  issueSalesInvoice,
  listSalesInvoices,
} from "@/lib/data/finance-documents";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { issueSalesInvoiceSchema } from "@/lib/validations/finance-documents";

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const invoices = await listSalesInvoices(session.orgId);
    return NextResponse.json({ data: invoices });
  } catch (err) {
    return handleFinanceApiError(err, "[api/sales-invoices GET]");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "invoice.issue")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const parsed = issueSalesInvoiceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const invoice = await issueSalesInvoice(session.orgId, session.userId, parsed.data);
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (err) {
    return handleFinanceApiError(err, "[api/sales-invoices POST]");
  }
}

function handleFinanceApiError(err: unknown, label: string) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof FinanceDocumentError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(label, err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

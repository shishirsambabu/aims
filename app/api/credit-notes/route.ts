import { NextResponse, type NextRequest } from "next/server";

import {
  FinanceDocumentError,
  issueCreditNote,
  listCreditNotes,
} from "@/lib/data/finance-documents";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { issueCreditNoteSchema } from "@/lib/validations/finance-documents";

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const notes = await listCreditNotes(session.orgId);
    return NextResponse.json({ data: notes });
  } catch (err) {
    return handleFinanceApiError(err, "[api/credit-notes GET]");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "creditnote.issue")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const parsed = issueCreditNoteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const note = await issueCreditNote(session.orgId, session.userId, parsed.data);
    return NextResponse.json({ data: note }, { status: 201 });
  } catch (err) {
    return handleFinanceApiError(err, "[api/credit-notes POST]");
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

import { NextResponse, type NextRequest } from "next/server";

import {
  closeFinancePeriod,
  createBankStatementLine,
  createCustomerDispute,
  FinanceControlError,
  getFinanceControlWorkspace,
  matchBankReceipt,
  postJournalEntry,
  reviewCustomerDispute,
} from "@/lib/data/finance-controls";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  bankMatchSchema,
  bankStatementLineSchema,
  customerDisputeReviewSchema,
  customerDisputeSchema,
  financePeriodCloseSchema,
  journalEntrySchema,
} from "@/lib/validations/finance-controls";

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "financials.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const data = await getFinanceControlWorkspace(session.orgId);
    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err, "[api/finance-controls GET]");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const kind = typeof body.kind === "string" ? body.kind : "";

    if (kind === "bank-line") {
      if (!can(session.role, "bank.reconcile")) return forbidden();
      const parsed = bankStatementLineSchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error.flatten());
      const data = await createBankStatementLine(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data }, { status: 201 });
    }

    if (kind === "bank-match") {
      if (!can(session.role, "bank.reconcile")) return forbidden();
      const parsed = bankMatchSchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error.flatten());
      const data = await matchBankReceipt(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data });
    }

    if (kind === "journal-entry") {
      if (!can(session.role, "journal.post")) return forbidden();
      const parsed = journalEntrySchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error.flatten());
      const data = await postJournalEntry(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data }, { status: 201 });
    }

    if (kind === "period-close") {
      if (!can(session.role, "finance.close")) return forbidden();
      const parsed = financePeriodCloseSchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error.flatten());
      const data = await closeFinancePeriod(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data });
    }

    if (kind === "dispute") {
      if (!can(session.role, "dispute.manage")) return forbidden();
      const parsed = customerDisputeSchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error.flatten());
      const data = await createCustomerDispute(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data }, { status: 201 });
    }

    if (kind === "dispute-review") {
      if (!can(session.role, "dispute.manage")) return forbidden();
      const parsed = customerDisputeReviewSchema.safeParse(body);
      if (!parsed.success) return validation(parsed.error.flatten());
      const data = await reviewCustomerDispute(session.orgId, session.userId, parsed.data);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Invalid finance control action" }, { status: 422 });
  } catch (err) {
    return handleError(err, "[api/finance-controls POST]");
  }
}

function forbidden() {
  return NextResponse.json({ error: "Not permitted" }, { status: 403 });
}

function validation(issues: unknown) {
  return NextResponse.json({ error: "Validation failed", issues }, { status: 422 });
}

function handleError(err: unknown, label: string) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof FinanceControlError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(label, err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

import "server-only";

import { Prisma } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { prisma } from "@/lib/prisma";
import type {
  bankMatchSchema,
  bankStatementLineSchema,
  customerDisputeReviewSchema,
  customerDisputeSchema,
  financePeriodCloseSchema,
  journalEntrySchema,
} from "@/lib/validations/finance-controls";
import type { z } from "zod";

type BankStatementLineInput = z.infer<typeof bankStatementLineSchema>;
type BankMatchInput = z.infer<typeof bankMatchSchema>;
type JournalEntryInput = z.infer<typeof journalEntrySchema>;
type FinancePeriodCloseInput = z.infer<typeof financePeriodCloseSchema>;
type CustomerDisputeInput = z.infer<typeof customerDisputeSchema>;
type CustomerDisputeReviewInput = z.infer<typeof customerDisputeReviewSchema>;

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function getFinanceControlWorkspace(orgId: string) {
  const [bankLines, unmatchedReceipts, journals, periods, disputes] = await Promise.all([
    prisma.bankStatementLine.findMany({
      where: { orgId },
      orderBy: [{ statementDate: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        customer: { select: { name: true } },
        customerReceipt: { select: { receiptNo: true, amount: true } },
      },
    }),
    prisma.customerReceipt.findMany({
      where: {
        orgId,
        status: "Posted",
        deletedAt: null,
        bankStatementLines: { none: { status: "Matched" } },
      },
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        customer: { select: { name: true, code: true } },
      },
    }),
    prisma.journalEntry.findMany({
      where: { orgId },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: { lines: true },
    }),
    prisma.financePeriodClose.findMany({
      where: { orgId },
      orderBy: [{ periodKey: "desc" }],
      take: 18,
    }),
    prisma.customerDispute.findMany({
      where: { orgId },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: {
        customer: { select: { name: true, code: true } },
        salesInvoice: { select: { invoiceNo: true } },
        salesReturn: { select: { returnNo: true } },
        creditNote: { select: { creditNoteNo: true } },
      },
    }),
  ]);

  return {
    summary: {
      unmatchedBankLines: bankLines.filter((line) => line.status === "Unmatched").length,
      bankExceptions: bankLines.filter((line) => line.status === "Exception").length,
      postedJournals: journals.filter((entry) => entry.status === "Posted").length,
      openDisputes: disputes.filter((dispute) => ["Open", "UnderReview"].includes(dispute.status)).length,
      closedPeriods: periods.filter((period) => period.status === "Closed").length,
    },
    bankLines: bankLines.map((line) => ({
      id: line.id,
      bankName: line.bankName,
      statementDate: iso(line.statementDate)!,
      description: line.description,
      referenceNo: line.referenceNo,
      currency: line.currency,
      debitAmount: dec(line.debitAmount),
      creditAmount: dec(line.creditAmount),
      status: line.status,
      customerName: line.customer?.name ?? null,
      receiptNo: line.customerReceipt?.receiptNo ?? null,
      matchNotes: line.matchNotes,
    })),
    unmatchedReceipts: unmatchedReceipts.map((receipt) => ({
      id: receipt.id,
      receiptNo: receipt.receiptNo,
      receiptDate: iso(receipt.receiptDate)!,
      customerName: receipt.customer.name,
      customerCode: receipt.customer.code,
      currency: receipt.currency,
      amount: dec(receipt.amount),
      referenceNo: receipt.referenceNo,
      bankName: receipt.bankName,
    })),
    journals: journals.map((entry) => ({
      id: entry.id,
      entryNo: entry.entryNo,
      entryDate: iso(entry.entryDate)!,
      status: entry.status,
      narration: entry.narration,
      debitTotal: entry.lines.reduce((sum, line) => sum + dec(line.debitAmount), 0),
      creditTotal: entry.lines.reduce((sum, line) => sum + dec(line.creditAmount), 0),
      lineCount: entry.lines.length,
    })),
    periods: periods.map((period) => ({
      id: period.id,
      periodKey: period.periodKey,
      status: period.status,
      receivablesTotal: dec(period.receivablesTotal),
      bankUnmatchedCount: period.bankUnmatchedCount,
      journalImbalanceCount: period.journalImbalanceCount,
      closeNotes: period.closeNotes,
      closedAt: iso(period.closedAt),
    })),
    disputes: disputes.map((dispute) => ({
      id: dispute.id,
      disputeNo: dispute.disputeNo,
      customerName: dispute.customer.name,
      customerCode: dispute.customer.code,
      status: dispute.status,
      priority: dispute.priority,
      reason: dispute.reason,
      claimAmount: dec(dispute.claimAmount),
      approvedAmount: dec(dispute.approvedAmount),
      linkedDocument:
        dispute.salesInvoice?.invoiceNo ??
        dispute.salesReturn?.returnNo ??
        dispute.creditNote?.creditNoteNo ??
        null,
      resolutionNotes: dispute.resolutionNotes,
      createdAt: iso(dispute.createdAt)!,
    })),
  };
}

export async function createBankStatementLine(
  orgId: string,
  userId: string | null,
  input: BankStatementLineInput
) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.bankStatementLine.create({
      data: {
        orgId,
        bankName: input.bankName,
        accountNo: input.accountNo ?? null,
        statementDate: input.statementDate ?? new Date(),
        valueDate: input.valueDate ?? null,
        description: input.description,
        referenceNo: input.referenceNo ?? null,
        currency: input.currency,
        debitAmount: input.debitAmount,
        creditAmount: input.creditAmount,
        balanceAmount: input.balanceAmount ?? null,
        uploadedById: userId,
      },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "uploaded_bank_statement_line",
      entityType: "bank_statement_line",
      entityId: line.id,
      summary: `Uploaded bank line ${line.referenceNo ?? line.description}`,
      metadata: { creditAmount: input.creditAmount, debitAmount: input.debitAmount },
    });
    return line;
  });
}

export async function matchBankReceipt(orgId: string, userId: string | null, input: BankMatchInput) {
  const [line, receipt] = await Promise.all([
    prisma.bankStatementLine.findFirst({ where: { id: input.bankStatementLineId, orgId } }),
    prisma.customerReceipt.findFirst({
      where: { id: input.customerReceiptId, orgId, status: "Posted", deletedAt: null },
    }),
  ]);
  if (!line) throw new FinanceControlError("Bank line not found", 404);
  if (!receipt) throw new FinanceControlError("Receipt not found", 404);
  if (line.currency !== receipt.currency) throw new FinanceControlError("Currency mismatch", 409);
  if (Math.abs(dec(line.creditAmount) - dec(receipt.amount)) > 1) {
    throw new FinanceControlError("Bank credit does not match receipt amount", 409);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.bankStatementLine.update({
      where: { id: line.id },
      data: {
        status: "Matched",
        customerId: receipt.customerId,
        customerReceiptId: receipt.id,
        matchConfidence: 100,
        matchNotes: input.matchNotes,
        matchedById: userId,
        matchedAt: new Date(),
      },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "matched_bank_receipt",
      entityType: "bank_statement_line",
      entityId: updated.id,
      summary: `Matched bank line to receipt ${receipt.receiptNo}`,
      metadata: { receiptId: receipt.id, receiptNo: receipt.receiptNo },
    });
    return updated;
  });
}

export async function postJournalEntry(orgId: string, userId: string | null, input: JournalEntryInput) {
  return prisma.$transaction(async (tx) => {
    const entryNo = await nextDocumentNumber(tx, orgId, "journal-entry", "JV", 5);
    const entry = await tx.journalEntry.create({
      data: {
        orgId,
        entryNo,
        entryDate: input.entryDate ?? new Date(),
        status: "Posted",
        narration: input.narration,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        postedById: userId,
        lines: {
          create: input.lines.map((line, index) => ({
            orgId,
            lineNo: index + 1,
            accountCode: line.accountCode,
            accountName: line.accountName,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            memo: line.memo ?? null,
          })),
        },
      },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "posted_journal_entry",
      entityType: "journal_entry",
      entityId: entry.id,
      summary: `Posted journal ${entryNo}`,
      metadata: { lineCount: input.lines.length },
    });
    return entry;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function closeFinancePeriod(
  orgId: string,
  userId: string | null,
  input: FinancePeriodCloseInput
) {
  const [unmatchedBankCount, receivableRows, journalRows] = await Promise.all([
    prisma.bankStatementLine.count({ where: { orgId, status: { in: ["Unmatched", "Exception"] } } }),
    prisma.salesInvoice.findMany({
      where: { orgId, status: "Issued" },
      include: { creditNotes: { where: { status: "Issued" }, select: { amount: true } } },
    }),
    prisma.journalEntry.findMany({ where: { orgId, status: "Posted" }, include: { lines: true } }),
  ]);
  const receivablesTotal = receivableRows.reduce(
    (sum, invoice) =>
      sum + dec(invoice.totalAmount) - invoice.creditNotes.reduce((s, note) => s + dec(note.amount), 0),
    0
  );
  const journalImbalanceCount = journalRows.filter((entry) => {
    const debit = entry.lines.reduce((sum, line) => sum + dec(line.debitAmount), 0);
    const credit = entry.lines.reduce((sum, line) => sum + dec(line.creditAmount), 0);
    return Math.abs(debit - credit) > 0.01;
  }).length;

  if (unmatchedBankCount > 0 || journalImbalanceCount > 0) {
    throw new FinanceControlError("Cannot close period with unmatched bank lines or imbalanced journals", 409);
  }

  return prisma.$transaction(async (tx) => {
    const period = await tx.financePeriodClose.upsert({
      where: { orgId_periodKey: { orgId, periodKey: input.periodKey } },
      create: {
        orgId,
        periodKey: input.periodKey,
        status: "Closed",
        receivablesTotal,
        bankUnmatchedCount: unmatchedBankCount,
        journalImbalanceCount,
        closeNotes: input.closeNotes,
        closedById: userId,
        closedAt: new Date(),
        checklist: {
          bankReconciled: true,
          journalsBalanced: true,
          receivablesCaptured: true,
        },
      },
      update: {
        status: "Closed",
        receivablesTotal,
        bankUnmatchedCount: unmatchedBankCount,
        journalImbalanceCount,
        closeNotes: input.closeNotes,
        closedById: userId,
        closedAt: new Date(),
      },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "closed_finance_period",
      entityType: "finance_period_close",
      entityId: period.id,
      summary: `Closed finance period ${input.periodKey}`,
      metadata: { receivablesTotal },
    });
    return period;
  });
}

export async function createCustomerDispute(
  orgId: string,
  userId: string | null,
  input: CustomerDisputeInput
) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, orgId } });
  if (!customer) throw new FinanceControlError("Customer not found", 404);
  return prisma.$transaction(async (tx) => {
    const disputeNo = await nextDocumentNumber(tx, orgId, "customer-dispute", "DSP", 5);
    const dispute = await tx.customerDispute.create({
      data: {
        orgId,
        disputeNo,
        customerId: input.customerId,
        salesInvoiceId: input.salesInvoiceId ?? null,
        salesReturnId: input.salesReturnId ?? null,
        creditNoteId: input.creditNoteId ?? null,
        priority: input.priority,
        reason: input.reason,
        claimAmount: input.claimAmount ?? null,
        createdById: userId,
      },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "created_customer_dispute",
      entityType: "customer_dispute",
      entityId: dispute.id,
      summary: `Created dispute ${disputeNo} for ${customer.name}`,
      metadata: { claimAmount: input.claimAmount, reason: input.reason },
    });
    return dispute;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reviewCustomerDispute(
  orgId: string,
  userId: string | null,
  input: CustomerDisputeReviewInput
) {
  const dispute = await prisma.customerDispute.findFirst({ where: { id: input.disputeId, orgId } });
  if (!dispute) throw new FinanceControlError("Dispute not found", 404);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customerDispute.update({
      where: { id: dispute.id },
      data: {
        status: input.status,
        approvedAmount: input.approvedAmount ?? null,
        resolutionNotes: input.resolutionNotes,
        reviewedById: userId,
        reviewedAt: new Date(),
        resolvedAt: input.status === "Resolved" ? new Date() : undefined,
      },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "reviewed_customer_dispute",
      entityType: "customer_dispute",
      entityId: dispute.id,
      summary: `Moved dispute ${dispute.disputeNo} to ${input.status}`,
      metadata: { status: input.status, approvedAmount: input.approvedAmount },
    });
    return updated;
  });
}

export class FinanceControlError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

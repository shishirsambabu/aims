import "server-only";

import { Prisma } from "@prisma/client";

import { nextDocumentNumber } from "@/lib/document-sequence";

function money(value: unknown): number {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

async function sourceAlreadyPosted(
  tx: Prisma.TransactionClient,
  orgId: string,
  sourceType: string,
  sourceId: string
) {
  const count = await tx.journalEntry.count({
    where: { orgId, sourceType, sourceId, status: "Posted" },
  });
  return count > 0;
}

export async function postJournalForSalesInvoice(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    userId: string | null;
    invoiceId: string;
    invoiceNo: string;
    invoiceDate: Date;
    taxableAmount: number;
    taxAmount: number;
    totalAmount: number;
  }
) {
  if (await sourceAlreadyPosted(tx, input.orgId, "sales_invoice", input.invoiceId)) return null;
  const entryNo = await nextDocumentNumber(tx, input.orgId, "journal-entry", "JV", 5);
  return tx.journalEntry.create({
    data: {
      orgId: input.orgId,
      entryNo,
      entryDate: input.invoiceDate,
      status: "Posted",
      sourceType: "sales_invoice",
      sourceId: input.invoiceId,
      narration: `Auto-post invoice ${input.invoiceNo}`,
      postedById: input.userId,
      lines: {
        create: [
          {
            orgId: input.orgId,
            lineNo: 1,
            accountCode: "AR",
            accountName: "Accounts Receivable",
            debitAmount: money(input.totalAmount),
            creditAmount: 0,
          },
          {
            orgId: input.orgId,
            lineNo: 2,
            accountCode: "SALES",
            accountName: "Sales Revenue",
            debitAmount: 0,
            creditAmount: money(input.taxableAmount),
          },
          ...(money(input.taxAmount) > 0
            ? [
                {
                  orgId: input.orgId,
                  lineNo: 3,
                  accountCode: "GST_PAYABLE",
                  accountName: "GST Output Payable",
                  debitAmount: 0,
                  creditAmount: money(input.taxAmount),
                },
              ]
            : []),
        ],
      },
    },
  });
}

export async function postJournalForCustomerReceipt(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    userId: string | null;
    receiptId: string;
    receiptNo: string;
    receiptDate: Date;
    method: string;
    amount: number;
  }
) {
  if (await sourceAlreadyPosted(tx, input.orgId, "customer_receipt", input.receiptId)) return null;
  const entryNo = await nextDocumentNumber(tx, input.orgId, "journal-entry", "JV", 5);
  const cashAccount = input.method === "Cash" ? "Cash on Hand" : "Bank Clearing";
  const cashCode = input.method === "Cash" ? "CASH" : "BANK";
  return tx.journalEntry.create({
    data: {
      orgId: input.orgId,
      entryNo,
      entryDate: input.receiptDate,
      status: "Posted",
      sourceType: "customer_receipt",
      sourceId: input.receiptId,
      narration: `Auto-post receipt ${input.receiptNo}`,
      postedById: input.userId,
      lines: {
        create: [
          {
            orgId: input.orgId,
            lineNo: 1,
            accountCode: cashCode,
            accountName: cashAccount,
            debitAmount: money(input.amount),
            creditAmount: 0,
          },
          {
            orgId: input.orgId,
            lineNo: 2,
            accountCode: "AR",
            accountName: "Accounts Receivable",
            debitAmount: 0,
            creditAmount: money(input.amount),
          },
        ],
      },
    },
  });
}

export async function postJournalForCreditNote(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    userId: string | null;
    creditNoteId: string;
    creditNoteNo: string;
    creditDate: Date;
    amount: number;
  }
) {
  if (await sourceAlreadyPosted(tx, input.orgId, "credit_note", input.creditNoteId)) return null;
  const entryNo = await nextDocumentNumber(tx, input.orgId, "journal-entry", "JV", 5);
  return tx.journalEntry.create({
    data: {
      orgId: input.orgId,
      entryNo,
      entryDate: input.creditDate,
      status: "Posted",
      sourceType: "credit_note",
      sourceId: input.creditNoteId,
      narration: `Auto-post credit note ${input.creditNoteNo}`,
      postedById: input.userId,
      lines: {
        create: [
          {
            orgId: input.orgId,
            lineNo: 1,
            accountCode: "SALES_RETURNS",
            accountName: "Sales Returns / Credit Notes",
            debitAmount: money(input.amount),
            creditAmount: 0,
          },
          {
            orgId: input.orgId,
            lineNo: 2,
            accountCode: "AR",
            accountName: "Accounts Receivable",
            debitAmount: 0,
            creditAmount: money(input.amount),
          },
        ],
      },
    },
  });
}

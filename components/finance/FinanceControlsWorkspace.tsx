"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Landmark, LockKeyhole, Scale } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatINR, formatMoney } from "@/lib/utils";

type FinanceControlData = {
  summary: {
    unmatchedBankLines: number;
    bankExceptions: number;
    postedJournals: number;
    openDisputes: number;
    closedPeriods: number;
  };
  bankLines: {
    id: string;
    bankName: string;
    statementDate: string;
    description: string;
    referenceNo: string | null;
    currency: "USD" | "AED" | "INR";
    debitAmount: number;
    creditAmount: number;
    status: string;
    customerName: string | null;
    receiptNo: string | null;
    matchNotes: string | null;
  }[];
  unmatchedReceipts: {
    id: string;
    receiptNo: string;
    receiptDate: string;
    customerName: string;
    customerCode: string;
    currency: "USD" | "AED" | "INR";
    amount: number;
    referenceNo: string | null;
    bankName: string | null;
  }[];
  journals: {
    id: string;
    entryNo: string;
    entryDate: string;
    status: string;
    narration: string;
    debitTotal: number;
    creditTotal: number;
    lineCount: number;
  }[];
  periods: {
    id: string;
    periodKey: string;
    status: string;
    receivablesTotal: number;
    bankUnmatchedCount: number;
    journalImbalanceCount: number;
    closeNotes: string | null;
    closedAt: string | null;
  }[];
  disputes: {
    id: string;
    disputeNo: string;
    customerName: string;
    customerCode: string;
    status: string;
    priority: string;
    reason: string;
    claimAmount: number;
    approvedAmount: number;
    linkedDocument: string | null;
    resolutionNotes: string | null;
    createdAt: string;
  }[];
};

export function FinanceControlsWorkspace({
  data,
  canReconcile,
  canPostJournal,
  canClose,
  canManageDisputes,
}: {
  data: FinanceControlData;
  canReconcile: boolean;
  canPostJournal: boolean;
  canClose: boolean;
  canManageDisputes: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    statementDate: new Date().toISOString().slice(0, 10),
    description: "",
    referenceNo: "",
    creditAmount: "",
  });
  const [journalForm, setJournalForm] = useState({
    narration: "",
    debitAccount: "Accounts Receivable",
    creditAccount: "Sales Revenue",
    amount: "",
  });
  const [periodKey, setPeriodKey] = useState(new Date().toISOString().slice(0, 7));
  const [closeNotes, setCloseNotes] = useState("");
  const [receiptMatches, setReceiptMatches] = useState<Record<string, string>>({});

  async function post(kind: string, payload: Record<string, unknown>) {
    setBusy(kind);
    try {
      const res = await fetch("/api/finance-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Finance control action failed");
        return false;
      }
      toast.success("Finance control updated");
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function uploadBankLine() {
    const ok = await post("bank-line", {
      ...bankForm,
      creditAmount: Number(bankForm.creditAmount),
      debitAmount: 0,
    });
    if (ok) setBankForm({ bankName: "", statementDate: new Date().toISOString().slice(0, 10), description: "", referenceNo: "", creditAmount: "" });
  }

  async function postJournal() {
    const amount = Number(journalForm.amount);
    const ok = await post("journal-entry", {
      narration: journalForm.narration,
      lines: [
        { accountCode: "AR", accountName: journalForm.debitAccount, debitAmount: amount, creditAmount: 0 },
        { accountCode: "REV", accountName: journalForm.creditAccount, debitAmount: 0, creditAmount: amount },
      ],
    });
    if (ok) setJournalForm({ narration: "", debitAccount: "Accounts Receivable", creditAccount: "Sales Revenue", amount: "" });
  }

  async function closePeriod() {
    await post("period-close", { periodKey, closeNotes });
  }

  async function matchReceipt(bankStatementLineId: string) {
    const customerReceiptId = receiptMatches[bankStatementLineId];
    if (!customerReceiptId) {
      toast.error("Choose a receipt before matching the bank line");
      return;
    }
    await post("bank-match", {
      bankStatementLineId,
      customerReceiptId,
      matchNotes: "Matched from finance control desk",
    });
  }

  async function reviewDispute(disputeId: string, status: "UnderReview" | "Approved" | "Rejected" | "Resolved") {
    const resolutionNotes = window.prompt(`Reason / notes for ${status}`);
    if (!resolutionNotes?.trim()) return;
    const amountText = status === "Approved" ? window.prompt("Approved amount", "0") : undefined;
    await post("dispute-review", {
      disputeId,
      status,
      resolutionNotes,
      approvedAmount: amountText ? Number(amountText) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="Unmatched bank" value={data.summary.unmatchedBankLines.toString()} icon={Landmark} />
        <Metric label="Bank exceptions" value={data.summary.bankExceptions.toString()} icon={Scale} />
        <Metric label="Posted journals" value={data.summary.postedJournals.toString()} icon={BookOpenCheck} />
        <Metric label="Open disputes" value={data.summary.openDisputes.toString()} icon={Scale} />
        <Metric label="Closed periods" value={data.summary.closedPeriods.toString()} icon={LockKeyhole} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-lg">
          <CardContent className="space-y-3 p-5">
            <p className="label-caps">Bank reconciliation</p>
            <h3 className="font-heading text-lg font-semibold">Upload bank credit</h3>
            <Input placeholder="Bank name" value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} />
            <Input type="date" value={bankForm.statementDate} onChange={(e) => setBankForm({ ...bankForm, statementDate: e.target.value })} />
            <Input placeholder="Reference / UTR" value={bankForm.referenceNo} onChange={(e) => setBankForm({ ...bankForm, referenceNo: e.target.value })} />
            <Input placeholder="Description" value={bankForm.description} onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })} />
            <Input type="number" placeholder="Credit amount" value={bankForm.creditAmount} onChange={(e) => setBankForm({ ...bankForm, creditAmount: e.target.value })} />
            <Button onClick={() => void uploadBankLine()} disabled={!canReconcile || busy === "bank-line"}>Add bank line</Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="space-y-3 p-5">
            <p className="label-caps">Journal posting</p>
            <h3 className="font-heading text-lg font-semibold">Balanced journal</h3>
            <Input placeholder="Narration" value={journalForm.narration} onChange={(e) => setJournalForm({ ...journalForm, narration: e.target.value })} />
            <Input placeholder="Debit account" value={journalForm.debitAccount} onChange={(e) => setJournalForm({ ...journalForm, debitAccount: e.target.value })} />
            <Input placeholder="Credit account" value={journalForm.creditAccount} onChange={(e) => setJournalForm({ ...journalForm, creditAccount: e.target.value })} />
            <Input type="number" placeholder="Amount" value={journalForm.amount} onChange={(e) => setJournalForm({ ...journalForm, amount: e.target.value })} />
            <Button onClick={() => void postJournal()} disabled={!canPostJournal || busy === "journal-entry"}>Post journal</Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="space-y-3 p-5">
            <p className="label-caps">Period close</p>
            <h3 className="font-heading text-lg font-semibold">Close finance month</h3>
            <Input type="month" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} />
            <Input placeholder="Close notes" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
            <Button onClick={() => void closePeriod()} disabled={!canClose || busy === "period-close"}>Close period</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent bank lines">
          {data.bankLines.length === 0 ? (
            <EmptyState icon={Landmark} title="No bank lines" description="Upload bank credits and match them to receipts." />
          ) : data.bankLines.map((line) => (
            <div key={line.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{line.bankName} - {line.referenceNo ?? "No ref"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(line.statementDate)} - {line.description}</p>
                  <p className="text-xs text-muted-foreground">{line.receiptNo ? `Matched to ${line.receiptNo}` : "Unmatched"}</p>
                </div>
                <div className="text-right">
                  <p className="font-financial">{formatMoney(line.creditAmount || line.debitAmount, line.currency)}</p>
                  <p className="text-xs text-muted-foreground">{line.status}</p>
                </div>
              </div>
              {canReconcile && line.status === "Unmatched" ? (
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <Select
                    value={receiptMatches[line.id] ?? ""}
                    onValueChange={(value) =>
                      setReceiptMatches((prev) => ({ ...prev, [line.id]: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Match to posted receipt" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.unmatchedReceipts
                        .filter(
                          (receipt) =>
                            receipt.currency === line.currency &&
                            Math.abs(receipt.amount - (line.creditAmount || line.debitAmount)) <= 1
                        )
                        .map((receipt) => (
                          <SelectItem key={receipt.id} value={receipt.id}>
                            {receipt.receiptNo} - {receipt.customerCode} - {formatMoney(receipt.amount, receipt.currency)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => void matchReceipt(line.id)}
                    disabled={busy === "bank-match"}
                  >
                    Match
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </Panel>

        <Panel title="Customer disputes">
          {data.disputes.length === 0 ? (
            <EmptyState icon={Scale} title="No disputes" description="High-value return and credit disputes will be managed here." />
          ) : data.disputes.map((dispute) => (
            <div key={dispute.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{dispute.disputeNo} - {dispute.customerName}</p>
                  <p className="text-xs text-muted-foreground">{dispute.status} - {dispute.priority} - {dispute.linkedDocument ?? "No doc"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{dispute.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-financial">{formatINR(dispute.claimAmount)}</p>
                  {canManageDisputes && ["Open", "UnderReview"].includes(dispute.status) ? (
                    <Select onValueChange={(value) => void reviewDispute(dispute.id, value as "UnderReview" | "Approved" | "Rejected" | "Resolved")}>
                      <SelectTrigger className="mt-2 h-8 w-32"><SelectValue placeholder="Review" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UnderReview">Review</SelectItem>
                        <SelectItem value="Approved">Approve</SelectItem>
                        <SelectItem value="Rejected">Reject</SelectItem>
                        <SelectItem value="Resolved">Resolve</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="Period close and journals">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            {data.periods.length === 0 ? (
              <EmptyState icon={LockKeyhole} title="No closed periods" description="Finance month closes will appear here." />
            ) : data.periods.map((period) => (
              <div key={period.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{period.periodKey} - {period.status}</p>
                <p className="text-xs text-muted-foreground">
                  AR {formatINR(period.receivablesTotal)} - Bank exceptions {period.bankUnmatchedCount}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {data.journals.map((journal) => (
              <div key={journal.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{journal.entryNo} - {journal.status}</p>
                <p className="text-xs text-muted-foreground">{journal.narration}</p>
                <p className="font-financial text-sm">{formatINR(journal.debitTotal)} / {formatINR(journal.creditTotal)}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Landmark }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-financial mt-1 text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-5">
        <h3 className="font-heading text-lg font-semibold">{title}</h3>
        <div className="mt-4 space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

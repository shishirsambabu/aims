"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate, formatINR } from "@/lib/utils";
import {
  CUSTOMER_CLASS_DESCRIPTIONS,
  CUSTOMER_CLASSES,
  CUSTOMER_ONBOARDING_REQUIREMENTS,
} from "@/lib/customer-segments";

type CustomerListRow = {
  id: string;
  code: string;
  name: string;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  deliveryInstructions: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  assignedRepId: string | null;
  assignedRepName: string | null;
  creditLimit: number | null;
  customerTier: string | null;
  paymentTermsDays: number;
  creditReviewDate: string | null;
  creditHold: boolean;
  kycStatus: "Pending" | "Approved" | "Rejected";
  approvalStatus: "Draft" | "PendingApproval" | "Approved" | "Rejected";
  contactCount: number;
  primaryContact: string | null;
  kycDocumentCount: number;
  notes: string | null;
};

type RepOption = {
  id: string;
  fullName: string | null;
  email: string;
  role: string;
};

const UNASSIGNED_REP = "__unassigned__";

type CustomerDetail = {
  id: string;
  code: string;
  name: string;
  tradeName: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  deliveryInstructions: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  creditLimit: number | null;
  customerTier: string | null;
  paymentTermsDays: number;
  creditReviewDate: string | null;
  creditHold: boolean;
  kycStatus: "Pending" | "Approved" | "Rejected";
  approvalStatus: "Draft" | "PendingApproval" | "Approved" | "Rejected";
  assignedRep: { id: string; fullName: string | null; email: string } | null;
  notes: string | null;
  contacts: {
    id: string;
    name: string;
    designation: string | null;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
    notes: string | null;
  }[];
  activityTimeline: {
    id: string;
    action: string;
    summary: string | null;
    createdAt: string | null;
    user: string | null;
  }[];
  kycDocuments: {
    id: string;
    docType: string;
    docNo: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    fileName: string | null;
    fileUrl: string | null;
    status: "Pending" | "Approved" | "Rejected";
    notes: string | null;
    reviewedBy: { fullName: string | null; email: string } | null;
    reviewedAt: string | null;
  }[];
  creditHoldTrail: {
    id: string;
    action: string;
    createdAt: string | null;
    user: string | null;
    from: boolean | null;
    to: boolean | null;
    reason: string | null;
  }[];
};

type AgingBucket = {
  label: string;
  count: number;
  amount: number;
};

type CustomerLedgerView = {
  summary: {
    outstanding: number;
    overdue: number;
    oldestDueDate: string | null;
    oldestAgeDays: number | null;
    agingBuckets: AgingBucket[];
  };
};

type FormState = {
  code: string;
  name: string;
  tradeName: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
  deliveryInstructions: string;
  city: string;
  state: string;
  region: string;
  assignedRepId: string;
  creditLimit: string;
  customerTier: string;
  paymentTermsDays: string;
  creditReviewDate: string;
  creditHold: boolean;
  creditHoldReason: string;
  notes: string;
};
type CustomerActionDialogState = {
  open: boolean;
  customerId: string;
  customerName: string;
  action: "approve" | "reject" | "archive";
  reason: string;
};
type KycReviewDialogState = {
  open: boolean;
  docId: string;
  docType: string;
  action: "approve" | "reject";
  reason: string;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  tradeName: "",
  gstin: "",
  pan: "",
  email: "",
  phone: "",
  billingAddress: "",
  shippingAddress: "",
  deliveryInstructions: "",
  city: "",
  state: "",
  region: "",
  assignedRepId: UNASSIGNED_REP,
  creditLimit: "",
  customerTier: "",
  paymentTermsDays: "0",
  creditReviewDate: "",
  creditHold: false,
  creditHoldReason: "",
  notes: "",
};

export function CustomerManager({
  customers,
  reps,
  canEdit,
  canApprove,
}: {
  customers: CustomerListRow[];
  reps: RepOption[];
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerListRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(customers[0]?.id ?? null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerView | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    designation: "",
    phone: "",
    email: "",
    isPrimary: false,
    notes: "",
  });
  const [docForm, setDocForm] = useState({
    docType: "GST Certificate",
    docNo: "",
    issueDate: "",
    expiryDate: "",
    fileName: "",
    filePath: "",
    fileUrl: "",
    notes: "",
  });
  const [customerActionDialog, setCustomerActionDialog] = useState<CustomerActionDialogState>({
    open: false,
    customerId: "",
    customerName: "",
    action: "approve",
    reason: "",
  });
  const [kycReviewDialog, setKycReviewDialog] = useState<KycReviewDialogState>({
    open: false,
    docId: "",
    docType: "",
    action: "approve",
    reason: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((row) =>
      [row.code, row.name, row.tradeName, row.gstin, row.pan, row.region, row.primaryContact]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [query, customers]);

  const activeSelectedId = selectedId ?? filtered[0]?.id ?? null;
  const kycSummary = useMemo(() => {
    if (!detail) return null;
    const approved = detail.kycDocuments.filter((doc) => doc.status === "Approved").length;
    const pending = detail.kycDocuments.filter((doc) => doc.status === "Pending").length;
    const rejected = detail.kycDocuments.filter((doc) => doc.status === "Rejected").length;
    return { approved, pending, rejected, total: detail.kycDocuments.length };
  }, [detail]);
  const exposureSummary = useMemo(() => {
    if (!ledger || !detail) return null;
    const limit = detail.creditLimit ?? 0;
    const outstanding = ledger.summary.outstanding;
    const overdue = ledger.summary.overdue;
    const utilization = limit > 0 ? Math.min((outstanding / limit) * 100, 999) : null;
    const headroom = limit > 0 ? Math.max(limit - outstanding, 0) : null;
    return { limit, outstanding, overdue, utilization, headroom };
  }, [detail, ledger]);
  const riskBadge = detail?.creditHold
    ? { label: "Credit Hold", variant: "danger" as const }
    : exposureSummary?.utilization == null
      ? { label: "No Limit", variant: "outline" as const }
      : exposureSummary.utilization >= 100
        ? { label: "Over Limit", variant: "danger" as const }
        : exposureSummary.utilization >= 85
          ? { label: "High Risk", variant: "warning" as const }
          : exposureSummary.utilization >= 60
          ? { label: "Watch", variant: "warning" as const }
            : { label: "Low Risk", variant: "success" as const };
  const riskTone = detail?.creditHold
    ? "danger"
    : exposureSummary?.utilization == null
      ? "neutral"
      : exposureSummary.utilization >= 100
        ? "danger"
        : exposureSummary.utilization >= 85
          ? "warning"
          : exposureSummary.utilization >= 60
            ? "watch"
            : "success";
  const selectedCustomerClass =
    detail?.customerTier && detail.customerTier in CUSTOMER_CLASS_DESCRIPTIONS
      ? (detail.customerTier as keyof typeof CUSTOMER_CLASS_DESCRIPTIONS)
      : null;

  useEffect(() => {
    if (!activeSelectedId) return;
    let ignore = false;
    async function load() {
      setDetailBusy(true);
      setLedgerBusy(true);
      setLedger(null);
      try {
        const [detailRes, ledgerRes] = await Promise.all([
          fetch(`/api/customers/${activeSelectedId}`),
          fetch(`/api/customer-receipts?customerId=${activeSelectedId}`),
        ]);
        const [detailJson, ledgerJson] = await Promise.all([detailRes.json(), ledgerRes.json()]);
        if (!detailRes.ok) {
          toast.error(detailJson.error ?? "Failed to load customer");
          return;
        }
        if (!ignore) setDetail(detailJson.data);
        if (!ledgerRes.ok) {
          toast.error(ledgerJson.error ?? "Failed to load customer ledger");
          if (!ignore) setLedger(null);
          return;
        }
        if (!ignore) setLedger(ledgerJson.data);
      } catch {
        toast.error("Network error");
      } finally {
        if (!ignore) setDetailBusy(false);
        if (!ignore) setLedgerBusy(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [activeSelectedId]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: CustomerListRow) {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      tradeName: row.tradeName ?? "",
      gstin: row.gstin ?? "",
      pan: row.pan ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      billingAddress: row.billingAddress ?? "",
      shippingAddress: row.shippingAddress ?? "",
      deliveryInstructions: row.deliveryInstructions ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      region: row.region ?? "",
      assignedRepId: row.assignedRepId ?? UNASSIGNED_REP,
      creditLimit: row.creditLimit == null ? "" : String(row.creditLimit),
      customerTier: row.customerTier ?? "",
      paymentTermsDays: String(row.paymentTermsDays),
      creditReviewDate: row.creditReviewDate?.slice(0, 10) ?? "",
      creditHold: row.creditHold,
      creditHoldReason: "",
      notes: row.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        ...form,
        assignedRepId:
          form.assignedRepId && form.assignedRepId !== UNASSIGNED_REP
            ? form.assignedRepId
            : undefined,
        creditLimit: form.creditLimit || undefined,
        paymentTermsDays: form.paymentTermsDays || "0",
        creditReviewDate: form.creditReviewDate || undefined,
        creditHoldReason: form.creditHoldReason || undefined,
      };
      const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && json.duplicate) {
          toast.error(
            `${json.error ?? "Duplicate customer"}: ${json.duplicate.code} - ${json.duplicate.name}`
          );
        } else {
          toast.error(json.error ?? "Failed to save customer");
        }
        return;
      }
      toast.success(editing ? "Customer update submitted" : "Customer submitted for review");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function openCustomerAction(row: CustomerListRow, action: CustomerActionDialogState["action"]) {
    setCustomerActionDialog({
      open: true,
      customerId: row.id,
      customerName: row.name,
      action,
      reason: "",
    });
  }

  async function submitCustomerAction() {
    const reason = customerActionDialog.reason.trim();
    if (reason.length < 3) {
      toast.error("A reason is required for the customer audit trail");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerActionDialog.customerId}`, {
        method: customerActionDialog.action === "archive" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:
          customerActionDialog.action === "archive"
            ? JSON.stringify({ reason })
            : JSON.stringify({ action: customerActionDialog.action, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Customer action failed");
        return;
      }
      toast.success(
        customerActionDialog.action === "archive"
          ? "Customer archive submitted"
          : customerActionDialog.action === "approve"
            ? "Customer change approved"
            : "Customer change rejected"
      );
      setCustomerActionDialog((current) => ({ ...current, open: false }));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addContact() {
    if (!detail) return;
    if (!contactForm.name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    const res = await fetch(`/api/customers/${detail.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contactForm),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to add contact");
      return;
    }
    toast.success("Contact added");
    setContactForm({
      name: "",
      designation: "",
      phone: "",
      email: "",
      isPrimary: false,
      notes: "",
    });
    await refreshDetail(detail.id);
  }

  async function addKycDoc() {
    if (!detail) return;
    if (!docForm.docType.trim()) {
      toast.error("Document type is required");
      return;
    }
    const res = await fetch(`/api/customers/${detail.id}/kyc-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(docForm),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to add KYC document");
      return;
    }
    toast.success("KYC document added");
    setDocForm({
      docType: "GST Certificate",
      docNo: "",
      issueDate: "",
      expiryDate: "",
      fileName: "",
      filePath: "",
      fileUrl: "",
      notes: "",
    });
    await refreshDetail(detail.id);
  }

  function openKycReviewDialog(doc: CustomerDetail["kycDocuments"][number], action: "approve" | "reject") {
    setKycReviewDialog({
      open: true,
      docId: doc.id,
      docType: doc.docType,
      action,
      reason: "",
    });
  }

  async function submitKycReview() {
    if (!detail) return;
    const reason = kycReviewDialog.reason.trim();
    if (kycReviewDialog.action === "reject" && reason.length < 3) {
      toast.error("A KYC rejection reason is required");
      return;
    }
    const res = await fetch(`/api/customers/${detail.id}/kyc-documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docId: kycReviewDialog.docId,
        action: kycReviewDialog.action,
        reason: reason || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to review KYC document");
      return;
    }
    toast.success(kycReviewDialog.action === "approve" ? "KYC approved" : "KYC rejected");
    setKycReviewDialog((current) => ({ ...current, open: false }));
    await refreshDetail(detail.id);
  }

  async function refreshDetail(customerId: string) {
    setDetailBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to load customer");
        return;
      }
      setDetail(json.data);
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, customer, GSTIN, PAN, region, rep..."
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Code" hint="Unique internal customer code">
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="CUST-001"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Name" hint="Legal customer name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="AIMS Retail Pvt Ltd"
                  />
                </Field>
                <Field label="Trade Name" hint="Optional invoicing name">
                  <Input
                    value={form.tradeName}
                    onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                    placeholder="AIMS Fruits"
                  />
                </Field>
                <Field label="Assigned Rep" hint="Route the account to a sales owner">
                  <Select value={form.assignedRepId} onValueChange={(v) => setForm({ ...form, assignedRepId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rep" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_REP}>Unassigned</SelectItem>
                      {reps.map((rep) => (
                        <SelectItem key={rep.id} value={rep.id}>
                          {rep.fullName ?? rep.email} ({rep.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="GSTIN" hint="15-character GST registration number">
                  <Input
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    placeholder="32ABCDE1234F1Z5"
                    autoComplete="off"
                  />
                </Field>
                <Field label="PAN" hint="Standard Indian PAN format">
                  <Input
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="accounts@example.com"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </Field>
                <Field label="City">
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Kochi" />
                </Field>
                <Field label="State">
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Kerala" />
                </Field>
                <Field label="Region">
                  <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="South Kerala" />
                </Field>
                <Field label="Credit Limit" hint="Stored in INR and used for credit control">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Customer Class" hint="Controls onboarding SOP, credit review, and sales handling.">
                  <Select value={form.customerTier || "__none__"} onValueChange={(value) => setForm({ ...form, customerTier: value === "__none__" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" disabled>Select customer class</SelectItem>
                      {CUSTOMER_CLASSES.map((customerClass) => (
                        <SelectItem key={customerClass} value={customerClass}>
                          {customerClass}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Payment Terms (days)">
                  <Input type="number" min="0" max="365" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} />
                </Field>
                <Field label="Next Credit Review">
                  <Input type="date" value={form.creditReviewDate} onChange={(e) => setForm({ ...form, creditReviewDate: e.target.value })} />
                </Field>
                <Field label="Billing Address">
                  <Input value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} />
                </Field>
                <Field label="Shipping Address">
                  <Input value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} />
                </Field>
                <Field label="Delivery Instructions" hint="Dock, receiving hours, unload contact, route, crate/pallet return rule">
                  <Input value={form.deliveryInstructions} onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value })} />
                </Field>
                <Field label="Notes">
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.creditHold}
                    onChange={(e) => setForm({ ...form, creditHold: e.target.checked })}
                  />
                  Credit hold
                </label>
                {(form.creditHold || editing?.creditHold !== form.creditHold) && (
                  <Field
                    label="Credit Hold Reason"
                    hint="Required when you place or remove a hold."
                  >
                    <Input
                      value={form.creditHoldReason}
                      onChange={(e) =>
                        setForm({ ...form, creditHoldReason: e.target.value })
                      }
                      placeholder="Why is this hold being changed?"
                    />
                  </Field>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit for Review
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Customer</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">KYC Docs</TableHead>
                {(canEdit || canApprove) && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit || canApprove ? 7 : 6} className="h-44 text-center text-muted-foreground">
                    <EmptyState
                      icon={UserRound}
                      title="No customers yet"
                      description="Add a customer, assign a rep, and lock down KYC before order intake."
                      className="border-0 bg-transparent py-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    className={row.id === activeSelectedId ? "bg-primary/5" : ""}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          href={`/customers/${row.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.code} {row.tradeName ? `· ${row.tradeName}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.region ?? "No region"} · {row.primaryContact ?? "No contact"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.kycStatus === "Approved"
                            ? "success"
                            : row.kycStatus === "Rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {row.kycStatus}
                      </Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.approvalStatus}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p className="font-financial">{formatINR(row.creditLimit)}</p>
                        {row.creditHold && (
                          <p className="text-xs text-danger">Credit hold</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.assignedRepName ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="font-financial text-right">{row.contactCount}</TableCell>
                    <TableCell className="font-financial text-right">{row.kycDocumentCount}</TableCell>
                    {(canEdit || canApprove) && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canApprove && row.approvalStatus === "PendingApproval" && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCustomerAction(row, "approve");
                                }}
                                className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-success"
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCustomerAction(row, "reject");
                                }}
                                className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger"
                                title="Reject"
                              >
                                <ShieldAlert className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {canEdit && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(row);
                                }}
                                className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-primary"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCustomerAction(row, "archive");
                                }}
                                className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger"
                                title="Archive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {detailBusy ? (
            <div className="flex h-full min-h-[520px] items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              <div>
                <p className="label-caps">Customer Profile</p>
                <h3 className="font-heading text-xl font-semibold">{detail.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {detail.code} · {detail.tradeName ?? "No trade name"}
                </p>
              </div>

              <Card
                className={cn(
                  "overflow-hidden border",
                  riskTone === "danger"
                    ? "border-danger/30 bg-danger/10"
                    : riskTone === "warning"
                      ? "border-warning/40 bg-warning/15"
                      : riskTone === "watch"
                        ? "border-warning/20 bg-warning/10"
                        : riskTone === "success"
                          ? "border-success/25 bg-success/10"
                          : "border-border bg-card"
                )}
              >
                <div
                  className={cn(
                    "h-1 w-full",
                    riskTone === "danger"
                      ? "bg-danger"
                      : riskTone === "warning" || riskTone === "watch"
                        ? "bg-warning"
                        : riskTone === "success"
                          ? "bg-success"
                          : "bg-border"
                  )}
                />
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="label-caps">Risk Summary</p>
                      <p className="text-sm text-muted-foreground">
                        {detail.creditHold
                          ? "Credit hold is active. Orders should stop until the block is cleared."
                          : exposureSummary?.utilization == null
                            ? "No credit limit is set yet."
                            : exposureSummary.utilization >= 100
                              ? "Exposure is over limit and requires immediate intervention."
                              : exposureSummary.utilization >= 85
                                ? "Exposure is high and should be reviewed before new orders."
                                : exposureSummary.utilization >= 60
                                  ? "Exposure is climbing. Keep this customer under watch."
                                  : "Exposure is healthy and within the safe band."}
                      </p>
                    </div>
                    <Badge variant={riskBadge.variant}>Risk {riskBadge.label}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr]">
                    <div className="rounded-xl border border-border bg-background/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Exposure band</p>
                      <p
                        className={cn(
                          "mt-2 font-heading text-2xl font-semibold",
                          riskTone === "danger"
                            ? "text-danger"
                            : riskTone === "warning" || riskTone === "watch"
                              ? "text-warning"
                              : riskTone === "success"
                                ? "text-success"
                                : "text-foreground"
                        )}
                      >
                        {ledgerBusy
                          ? "Loading..."
                          : exposureSummary?.utilization == null
                            ? "No limit"
                            : `${exposureSummary.utilization.toFixed(1)}%`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {detail.creditHold
                          ? "Blocked"
                          : exposureSummary?.utilization == null
                            ? "No credit ceiling"
                            : exposureSummary.utilization >= 100
                              ? "Over limit"
                              : exposureSummary.utilization >= 85
                                ? "High risk"
                                : exposureSummary.utilization >= 60
                                  ? "Watch"
                                  : "Safe"}
                      </p>
                    </div>
                    <Meta
                      label="Outstanding"
                      value={ledgerBusy ? "Loading..." : formatINR(exposureSummary?.outstanding ?? 0)}
                    />
                    <Meta
                      label="Overdue"
                      value={ledgerBusy ? "Loading..." : formatINR(exposureSummary?.overdue ?? 0)}
                    />
                    <Meta
                      label="Headroom"
                      value={
                        ledgerBusy
                          ? "Loading..."
                          : exposureSummary?.headroom == null
                            ? "No limit"
                            : formatINR(exposureSummary.headroom)
                      }
                    />
                  </div>
                  <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Credit Hold Override Trail
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Shows the last decision trail that changed or reviewed this risk state.
                        </p>
                      </div>
                      <Badge variant={detail.creditHold ? "danger" : "outline"}>
                        {detail.creditHold ? "Currently held" : "Open"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {detail.creditHoldTrail.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No credit hold override trail is recorded yet.
                        </p>
                      ) : (
                        detail.creditHoldTrail.slice(0, 4).map((entry) => (
                          <div
                            key={entry.id}
                            className={cn(
                              "rounded-lg border px-3 py-2",
                              entry.to
                                ? "border-danger/30 bg-danger/10"
                                : "border-success/25 bg-success/10"
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                {entry.to ? "Hold applied" : "Hold released"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.createdAt ? formatDate(entry.createdAt) : "Unknown date"}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              By {entry.user ?? "Unknown user"} · {entry.reason ?? "No reason captured"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    detail.kycStatus === "Approved"
                      ? "success"
                      : detail.kycStatus === "Rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  KYC {detail.kycStatus}
                </Badge>
                <Badge
                  variant={
                    detail.approvalStatus === "Approved"
                      ? "success"
                      : detail.approvalStatus === "Rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  Master {detail.approvalStatus}
                </Badge>
                <Badge variant={detail.creditHold ? "danger" : "outline"}>
                  {detail.creditHold ? "Credit Hold" : "Credit Open"}
                </Badge>
                <Badge variant="outline">
                  {selectedCustomerClass ?? "Unclassified"}
                </Badge>
              </div>

              <div className="rounded-2xl border border-border bg-surface-alt/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="label-caps">Onboarding SOP</p>
                    <h4 className="font-heading text-base font-semibold">
                      {selectedCustomerClass ?? "Customer class required"}
                    </h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedCustomerClass
                        ? CUSTOMER_CLASS_DESCRIPTIONS[selectedCustomerClass]
                        : "Choose a customer class before the account can be treated as ready for sales."}
                    </p>
                  </div>
                  <Badge
                    variant={
                      detail.approvalStatus === "Approved" &&
                      detail.kycStatus === "Approved" &&
                      selectedCustomerClass
                        ? "success"
                        : "warning"
                    }
                  >
                    {detail.approvalStatus === "Approved" &&
                    detail.kycStatus === "Approved" &&
                    selectedCustomerClass
                      ? "SOP Ready"
                      : "SOP Pending"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2">
                  {(selectedCustomerClass
                    ? CUSTOMER_ONBOARDING_REQUIREMENTS[selectedCustomerClass]
                    : [
                        "Select customer class",
                        "Verify GSTIN and PAN",
                        "Set credit limit and credit review date",
                        "Assign sales rep and region",
                      ]
                  ).map((requirement) => (
                    <div key={requirement} className="flex items-start gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 text-success" />
                      <span>{requirement}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-border bg-surface-alt/30 p-3 sm:grid-cols-3">
                <Meta
                  label="Credit Control"
                  value={detail.creditHold ? "Blocked" : "Open"}
                />
                <Meta
                  label="Limit"
                  value={formatINR(detail.creditLimit)}
                />
                <Meta
                  label="KYC Docs"
                  value={kycSummary?.total ?? 0}
                />
              </div>

              {ledger?.summary.agingBuckets ? (
                <div className="grid gap-2 sm:grid-cols-5">
                  {ledger.summary.agingBuckets.map((bucket) => (
                    <div key={bucket.label} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{bucket.label}</p>
                      <p className="mt-1 font-financial text-lg font-semibold">{formatINR(bucket.amount)}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Meta label="GSTIN" value={detail.gstin} />
                <Meta label="PAN" value={detail.pan} />
                <Meta label="Credit Limit" value={formatINR(detail.creditLimit)} />
                <Meta label="Customer Class" value={detail.customerTier} />
                <Meta label="Payment Terms" value={`${detail.paymentTermsDays} days`} />
                <Meta label="Credit Review" value={detail.creditReviewDate ? formatDate(detail.creditReviewDate) : "Not scheduled"} />
                <Meta label="Region" value={detail.region} />
                <Meta label="Assigned Rep" value={detail.assignedRep?.fullName ?? detail.assignedRep?.email} />
                <Meta label="Credit Hold" value={detail.creditHold ? "Yes" : "No"} />
                <Meta label="Delivery Instructions" value={detail.deliveryInstructions} />
              </div>

              <div className="grid gap-3 rounded-xl border border-border bg-surface-alt/30 p-3 sm:grid-cols-4">
                <Meta label="KYC Docs" value={kycSummary?.total ?? 0} />
                <Meta label="Approved" value={kycSummary?.approved ?? 0} />
                <Meta label="Pending" value={kycSummary?.pending ?? 0} />
                <Meta label="Rejected" value={kycSummary?.rejected ?? 0} />
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-base font-semibold">Activity Timeline</h4>
                </div>
                <div className="space-y-2">
                  {detail.activityTimeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No customer activity has been recorded yet.
                    </p>
                  ) : (
                    detail.activityTimeline.slice(0, 8).map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{entry.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.createdAt ? formatDate(entry.createdAt) : "Unknown date"}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.summary ?? "No summary"}
                          {entry.user ? ` · by ${entry.user}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-base font-semibold">Contacts</h4>
                </div>
                <div className="grid gap-2">
                  {detail.contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contacts added yet.</p>
                  ) : (
                    detail.contacts.map((c) => (
                      <div key={c.id} className="rounded-xl border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {c.name} {c.isPrimary && <Badge variant="success" className="ml-2">Primary</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.designation ?? "Contact"} · {c.phone ?? "No phone"} · {c.email ?? "No email"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {canEdit && (
                  <div className="grid gap-3 rounded-xl border border-border bg-surface-alt/40 p-3 sm:grid-cols-2">
                    <Input placeholder="Contact name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                    <Input placeholder="Designation" value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} />
                    <Input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
                    <Input placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                    <Input placeholder="Notes" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={contactForm.isPrimary}
                        onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                      />
                      Primary contact
                    </label>
                    <Button type="button" onClick={addContact} className="sm:col-span-2">
                      <Plus className="h-4 w-4" /> Add Contact
                    </Button>
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-base font-semibold">KYC Documents</h4>
                </div>
                <div className="grid gap-2">
                  {detail.kycDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No KYC documents added yet.</p>
                  ) : (
                    detail.kycDocuments.map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{doc.docType}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.docNo ?? "No doc no"} · exp {formatDate(doc.expiryDate)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {doc.fileName ?? "No file"} {doc.fileUrl ? "· file attached" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                doc.status === "Approved"
                                  ? "success"
                                  : doc.status === "Rejected"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {doc.status}
                            </Badge>
                            {canApprove && doc.status === "Pending" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openKycReviewDialog(doc, "approve")}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openKycReviewDialog(doc, "reject")}>
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {canEdit && (
                  <div className="grid gap-3 rounded-xl border border-border bg-surface-alt/40 p-3 sm:grid-cols-2">
                    <Input placeholder="Document type" value={docForm.docType} onChange={(e) => setDocForm({ ...docForm, docType: e.target.value })} />
                    <Input placeholder="Document no" value={docForm.docNo} onChange={(e) => setDocForm({ ...docForm, docNo: e.target.value })} />
                    <Input type="date" value={docForm.issueDate} onChange={(e) => setDocForm({ ...docForm, issueDate: e.target.value })} />
                    <Input type="date" value={docForm.expiryDate} onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })} />
                    <Input placeholder="File name" value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} />
                    <Input placeholder="File URL" value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} />
                    <Input placeholder="File path" value={docForm.filePath} onChange={(e) => setDocForm({ ...docForm, filePath: e.target.value })} />
                    <Input placeholder="Notes" value={docForm.notes} onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })} />
                    <Button type="button" onClick={addKycDoc} className="sm:col-span-2">
                      <Plus className="h-4 w-4" /> Add KYC Document
                    </Button>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <EmptyState
              icon={UserRound}
              title="Select a customer"
              description="Pick a row on the left to inspect contacts, KYC documents, and credit controls."
              className="border-0 bg-transparent py-10"
            />
          )}
        </div>
      </div>

      <Dialog
        open={customerActionDialog.open}
        onOpenChange={(open) =>
          setCustomerActionDialog((current) => ({ ...current, open }))
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {customerActionDialog.action === "archive"
                ? "Archive customer"
                : customerActionDialog.action === "approve"
                  ? "Approve customer change"
                  : "Reject customer change"}
            </DialogTitle>
            <DialogDescription>
              {customerActionDialog.customerName
                ? `${customerActionDialog.customerName} will be recorded with this review note.`
                : "Record a customer control decision."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason / review note">
            <Input
              value={customerActionDialog.reason}
              onChange={(event) =>
                setCustomerActionDialog((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Reviewed GSTIN/PAN, credit limit, assigned rep, and KYC state..."
            />
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCustomerActionDialog((current) => ({ ...current, open: false }))}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant={
                customerActionDialog.action === "reject" ||
                customerActionDialog.action === "archive"
                  ? "destructive"
                  : "default"
              }
              onClick={submitCustomerAction}
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {customerActionDialog.action === "archive"
                ? "Submit archive"
                : customerActionDialog.action === "approve"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={kycReviewDialog.open}
        onOpenChange={(open) => setKycReviewDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {kycReviewDialog.action === "approve" ? "Approve KYC document" : "Reject KYC document"}
            </DialogTitle>
            <DialogDescription>
              {kycReviewDialog.docType
                ? `${kycReviewDialog.docType} review will update the customer KYC state.`
                : "Review this KYC document."}
            </DialogDescription>
          </DialogHeader>
          <Field
            label={kycReviewDialog.action === "reject" ? "Rejection reason" : "Approval note"}
            hint={kycReviewDialog.action === "reject" ? "Required for rejected KYC documents." : "Optional but recommended for audit clarity."}
          >
            <Input
              value={kycReviewDialog.reason}
              onChange={(event) =>
                setKycReviewDialog((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Document verified against customer master..."
            />
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKycReviewDialog((current) => ({ ...current, open: false }))}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant={kycReviewDialog.action === "reject" ? "destructive" : "default"}
              onClick={submitKycReview}
              disabled={busy}
            >
              {kycReviewDialog.action === "approve" ? "Approve document" : "Reject document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

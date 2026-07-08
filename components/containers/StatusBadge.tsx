import { cn } from "@/lib/utils";
import { CONTAINER_STATUS_LABELS } from "@/lib/constants";
import type { ContainerStatus, DocumentStatus, PaymentStatus } from "@/types";

// Each pipeline stage gets a distinct, on-brand colour treatment.
const CONTAINER_STATUS_STYLES: Record<ContainerStatus, string> = {
  Booked: "bg-muted text-muted-foreground",
  InTransit: "bg-sky-100 text-sky-800",
  AtPort: "bg-indigo-100 text-indigo-800",
  CustomsClearance: "bg-amber-100 text-amber-800",
  Cleared: "bg-cyan-100 text-cyan-800",
  InWarehouse: "bg-violet-100 text-violet-800",
  EmptyReturned: "bg-teal-100 text-teal-800",
  PartiallySold: "bg-warning/20 text-[#9A6212]",
  FullySold: "bg-success/15 text-success",
};

export function StatusBadge({
  status,
  className,
}: {
  status: ContainerStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        CONTAINER_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {CONTAINER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const DOC_STATUS_STYLES: Record<DocumentStatus, string> = {
  Pending: "bg-muted text-muted-foreground",
  Uploaded: "bg-sky-100 text-sky-800",
  Verified: "bg-success/15 text-success",
  Expired: "bg-danger/10 text-danger",
};

export function DocStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        DOC_STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  Pending: "bg-danger/10 text-danger",
  Partial: "bg-warning/20 text-[#9A6212]",
  Paid: "bg-success/15 text-success",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        PAYMENT_STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  );
}

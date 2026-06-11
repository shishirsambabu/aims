import type { ApprovalStatus } from "@/types";

export function paymentReviewBlocker(input: {
  action: "approve" | "reject";
  requestedById?: string | null;
  reviewerId: string;
  approvalStatus: ApprovalStatus;
  reason?: string | null;
}) {
  if (input.approvalStatus !== "PendingApproval") {
    return "Payment has no pending approval item.";
  }

  if (input.action === "reject" && !input.reason?.trim()) {
    return "A rejection reason is required.";
  }

  if (
    input.action === "approve" &&
    input.requestedById &&
    input.requestedById === input.reviewerId
  ) {
    return "You can't approve a payment you raised - needs a second approver.";
  }

  return null;
}

export function paymentCanBePaid(approvalStatus: ApprovalStatus) {
  return approvalStatus === "Approved";
}

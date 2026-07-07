// Shared application types for AIMS.

export type Role =
  | "admin"
  | "gm"
  | "manager"
  | "sales_executive"
  | "warehouse"
  | "clearing_agent"
  | "finance"
  | "viewer"
  | "auditor";

export type ApprovalStatus =
  | "Draft"
  | "PendingApproval"
  | "Approved"
  | "Rejected";

export type ContainerStatus =
  | "Booked"
  | "InTransit"
  | "AtPort"
  | "CustomsClearance"
  | "Cleared"
  | "InWarehouse"
  | "EmptyReturned"
  | "PartiallySold"
  | "FullySold";

export type DocumentType =
  | "BillOfLading"
  | "CommercialInvoice"
  | "PackingList"
  | "BillOfEntry"
  | "CertificateOfOrigin"
  | "PhytosanitaryCertificate"
  | "Insurance"
  | "DeliveryOrder"
  | "Other";

export type DocumentStatus = "Pending" | "Uploaded" | "Verified" | "Expired";

export type PaymentStatus = "Pending" | "Partial" | "Paid";

export type Currency = "USD" | "AED" | "INR";

export type ReceiptMethod = "Cash" | "BankTransfer" | "UPI" | "Cheque" | "Card" | "Adjustment";

export type CustomerReceiptStatus = "Posted" | "Cancelled";

export type SalesInvoiceStatus = "Draft" | "Issued" | "Cancelled";

export type SalesReturnStatus = "Draft" | "Posted" | "Cancelled";

export type CreditNoteStatus = "Draft" | "Issued" | "Cancelled";

export type ReturnDisposition = "Restock" | "QualityHold" | "Dump" | "Reject";

export type BankReconciliationStatus = "Unmatched" | "Matched" | "Exception" | "Ignored";

export type JournalEntryStatus = "Draft" | "Posted" | "Reversed";

export type FinancePeriodStatus = "Open" | "Closing" | "Closed" | "Reopened";

export type CustomerDisputeStatus =
  | "Open"
  | "UnderReview"
  | "Approved"
  | "Rejected"
  | "Resolved";

export type TemperatureBreachSeverity = "Info" | "Warning" | "Critical";

export type TemperatureBreachTaskStatus =
  | "Open"
  | "Acknowledged"
  | "Resolved"
  | "Escalated";

export type CustomerKycStatus = "Pending" | "Approved" | "Rejected";

export type PriceListStatus = "Draft" | "Published" | "Archived";

export type SalesOrderStatus =
  | "Draft"
  | "PendingApproval"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "PartiallyFulfilled"
  | "Fulfilled";

export type CrmLeadStatus = "New" | "Qualified" | "Converted" | "Disqualified";

export type CrmOpportunityStage =
  | "Prospecting"
  | "Qualification"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost";

export type CrmTaskStatus = "Open" | "Done";

export type WarehouseLocationType = "Room" | "Zone" | "Bin" | "Dock" | "Staging";

export type CycleCountStatus = "Draft" | "InProgress" | "Completed";

export type StockUom =
  | "Box"
  | "Kg"
  | "Pallet"
  | "Punnet"
  | "Container"
  | "Carton"
  | "CasePack";

export type StockQualityStatus =
  | "Released"
  | "QualityHold"
  | "Quarantine"
  | "Rejected";

export interface AppUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  orgId: string;
}

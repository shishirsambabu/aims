import { describe, expect, it } from "vitest";

import { computeCost, computeProfit } from "@/lib/finance";
import {
  dossierArchiveName,
  dossierDocumentFileName,
  extensionFromName,
} from "@/lib/document-dossier";
import { paymentCanBePaid, paymentReviewBlocker } from "@/lib/payment-workflow";
import { can, normalizeRole } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import { validateDocumentUploadMetadata } from "@/lib/upload-security";
import { mapRow } from "@/lib/import/mapping";
import { createContainerSchema } from "@/lib/validations/container";
import { createDocumentSchema, updateDocumentSchema } from "@/lib/validations/document";
import { createPaymentSchema } from "@/lib/validations/payment";
import { priceListSchema, salesOrderReviewSchema, salesOrderSchema } from "@/lib/validations/sales";
import { customerReceiptCancelSchema } from "@/lib/validations/receipts";
import {
  gatePassSchema,
  stockAdjustmentSchema,
  stockQualitySchema,
  stockTransferSchema,
} from "@/lib/validations/stock";
import {
  customerKycReviewSchema,
  customerReviewSchema,
  customerSchema,
} from "@/lib/validations/customer";
import {
  financeDocumentCancelSchema,
  issueCreditNoteSchema,
  issueSalesInvoiceSchema,
  postSalesReturnSchema,
} from "@/lib/validations/finance-documents";
import {
  bankStatementLineSchema,
  financePeriodCloseSchema,
  journalEntrySchema,
} from "@/lib/validations/finance-controls";
import { coldRoomReadingSchema, temperatureTaskActionSchema } from "@/lib/validations/cold-chain";
import { redactRestrictedFinancialFields } from "@/lib/redaction";
import { isSameNavigationRoute } from "@/lib/navigation";
import { CUSTOMER_CLASSES } from "@/lib/customer-segments";
import { SOP_PLAYBOOKS } from "@/lib/sop";

describe("role permissions", () => {
  it("keeps financial visibility away from operations-only roles", () => {
    expect(can("clearing_agent", "financials.view")).toBe(false);
    expect(can("viewer", "financials.view")).toBe(false);
    expect(can("auditor", "financials.view")).toBe(true);
    expect(can("finance", "financials.view")).toBe(true);
    expect(can("gm", "financials.view")).toBe(true);
    expect(can("manager", "financials.view")).toBe(false);
    expect(can("warehouse", "warehouse.receive")).toBe(true);
    expect(can("clearing_agent", "warehouse.receive")).toBe(false);
    expect(can("sales_executive", "salesorder.write")).toBe(true);
    expect(can("warehouse", "warehouse.count.approve")).toBe(false);
    expect(can("manager", "warehouse.count.approve")).toBe(true);
    expect(can("finance", "invoice.issue")).toBe(true);
    expect(can("finance", "creditnote.issue")).toBe(true);
    expect(can("finance", "return.post")).toBe(true);
    expect(can("finance", "bank.reconcile")).toBe(true);
    expect(can("finance", "journal.post")).toBe(true);
    expect(can("finance", "finance.close")).toBe(true);
    expect(can("finance", "dispute.manage")).toBe(true);
    expect(can("warehouse", "coldchain.manage")).toBe(true);
    expect(can("sales_executive", "invoice.issue")).toBe(false);
    expect(can("warehouse", "creditnote.issue")).toBe(false);
    expect(can("sales_executive", "finance.close")).toBe(false);
  });

  it("keeps supplier approval limited to management roles", () => {
    expect(can("admin", "masterdata.approve")).toBe(true);
    expect(can("manager", "masterdata.approve")).toBe(true);
    expect(can("finance", "masterdata.approve")).toBe(false);
    expect(can("clearing_agent", "masterdata.approve")).toBe(false);
  });

  it("separates payment maker access from unrelated users", () => {
    expect(can("finance", "payment.write")).toBe(true);
    expect(can("finance", "payment.approve")).toBe(true);
    expect(can("clearing_agent", "payment.write")).toBe(false);
    expect(can("viewer", "payment.approve")).toBe(false);
  });

  it("keeps explicit operational roles separate", () => {
    expect(normalizeRole("clearing_agent")).toBe("clearing_agent");
    expect(normalizeRole("gm")).toBe("gm");
    expect(normalizeRole("not-a-role")).toBeUndefined();
  });
});

describe("module navigation", () => {
  it("keeps query-driven warehouse child links mutually exclusive", () => {
    expect(isSameNavigationRoute("/warehouse", new URLSearchParams(), "/warehouse")).toBe(true);
    expect(
      isSameNavigationRoute(
        "/warehouse",
        new URLSearchParams("tab=cycle-counts"),
        "/warehouse"
      )
    ).toBe(false);
    expect(
      isSameNavigationRoute(
        "/warehouse",
        new URLSearchParams("tab=cycle-counts"),
        "/warehouse?tab=cycle-counts"
      )
    ).toBe(true);
    expect(
      isSameNavigationRoute(
        "/warehouse",
        new URLSearchParams("tab=dispatch"),
        "/warehouse?tab=cycle-counts"
      )
    ).toBe(false);
    expect(
      isSameNavigationRoute(
        "/warehouse",
        new URLSearchParams("tab=dispatch"),
        "/warehouse?tab=dispatch"
      )
    ).toBe(true);
  });
});

describe("payment maker-checker workflow", () => {
  it("blocks a maker from approving their own payment request", () => {
    expect(
      paymentReviewBlocker({
        action: "approve",
        requestedById: "maker-1",
        reviewerId: "maker-1",
        approvalStatus: "PendingApproval",
      })
    ).toContain("second approver");
  });

  it("requires rejection reasons and blocks paying unapproved payments", () => {
    expect(
      paymentReviewBlocker({
        action: "reject",
        requestedById: "maker-1",
        reviewerId: "checker-1",
        approvalStatus: "PendingApproval",
      })
    ).toContain("rejection reason");

    expect(paymentCanBePaid("PendingApproval")).toBe(false);
    expect(paymentCanBePaid("Rejected")).toBe(false);
    expect(paymentCanBePaid("Approved")).toBe(true);
  });

  it("allows a different checker to approve a pending payment", () => {
    expect(
      paymentReviewBlocker({
        action: "approve",
        requestedById: "maker-1",
        reviewerId: "checker-1",
        approvalStatus: "PendingApproval",
      })
    ).toBeNull();
  });
});

describe("finance engine", () => {
  it("computes landed cost, rate per box, and final rate per box", () => {
    expect(
      computeCost(
        {
          beInvoiceValueInr: 100_000,
          customsDuty: 20_000,
          clearingCharges: 5_000,
          linerCharges: 3_000,
          detention: 2_000,
          chaCharges: 1_000,
          transport: 4_000,
          ohProportion: 12,
          claimDeduction: 2,
        },
        100
      )
    ).toEqual({
      totalCost: 135_000,
      ratePerBoxLanding: 1_350,
      ratePerBox: 1_360,
    });
  });

  it("computes profit without inventing per-box or margin values when denominators are missing", () => {
    expect(
      computeProfit({ saleValue: 0, damageValue: 200, soldQty: 0 }, 1_000)
    ).toEqual({
      profit: -1_200,
      profitPerBox: null,
      marginPct: null,
    });
  });
});

describe("SOP validation gates", () => {
  it("forces new containers to use ISO container numbers", () => {
    expect(
      createContainerSchema.safeParse({
        containerNo: "not-a-container",
        blNo: "BL-001",
        status: "Booked",
      }).success
    ).toBe(false);

    const parsed = createContainerSchema.safeParse({
      containerNo: "mnbu9052800",
      blNo: "BL-001",
      status: "Booked",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.containerNo).toBe("MNBU9052800");
  });

  it("rejects payment requests without a positive requested amount", () => {
    expect(
      createPaymentSchema.safeParse({
        containerId: "container-1",
        amountRequested: 0,
        currency: "USD",
      }).success
    ).toBe(false);
  });

  it("limits document verification updates to document metadata and status", () => {
    expect(updateDocumentSchema.safeParse({ status: "Verified" }).success).toBe(true);
    expect(updateDocumentSchema.safeParse({ status: "Approved" }).success).toBe(false);
  });
});

describe("sales and cold-chain controls", () => {
  it("rejects duplicate day-price rows and a floor above the base price", () => {
    const base = {
      warehouseId: "95b5bab3-d5e3-44c4-8b7c-6811422fa9bb",
      priceDate: "2026-06-20",
      items: [
        { item: "Apple", variety: "Gala", grade: "A", uom: "Box", basePrice: 100, floorPrice: 90 },
        { item: "apple", variety: "gala", grade: "a", uom: "Box", basePrice: 100, floorPrice: 90 },
      ],
    };
    expect(priceListSchema.safeParse(base).success).toBe(false);
    expect(
      priceListSchema.safeParse({
        ...base,
        items: [{ ...base.items[0], floorPrice: 110 }],
      }).success
    ).toBe(false);
  });

  it("requires an audit reason for every stock quality decision", () => {
    expect(
      stockQualitySchema.safeParse({
        stockItemId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        action: "quality",
        qualityStatus: "Released",
        reason: "",
      }).success
    ).toBe(false);
    expect(
      stockQualitySchema.safeParse({
        stockItemId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        action: "quality",
        qualityStatus: "Quarantine",
        reason: "Temperature logger exceeded target",
      }).success
    ).toBe(true);
  });

  it("requires reasons for stock ledger actions and validates lot transfers", () => {
    const stockItemId = "064ebaed-5850-4a05-bb8a-57b05c19134f";
    expect(
      stockAdjustmentSchema.safeParse({
        stockItemId,
        action: "wastage",
        qty: 2,
      }).success
    ).toBe(false);
    expect(
      stockAdjustmentSchema.safeParse({
        stockItemId,
        action: "wastage",
        qty: 2,
        reason: "QC damage during pallet inspection",
      }).success
    ).toBe(true);
    expect(
      stockTransferSchema.safeParse({
        stockItemId,
        action: "transfer",
        locationId: "7603054e-279a-46fd-8a92-e3a29da459b4",
      }).success
    ).toBe(false);
    expect(
      stockTransferSchema.safeParse({
        stockItemId,
        action: "transfer",
        locationId: "7603054e-279a-46fd-8a92-e3a29da459b4",
        reason: "Directed FEFO staging to dispatch bay",
      }).success
    ).toBe(true);
  });

  it("requires a reason for direct warehouse dispatch exceptions", () => {
    const base = {
      warehouseId: "7603054e-279a-46fd-8a92-e3a29da459b4",
      lines: [{ stockItemId: "064ebaed-5850-4a05-bb8a-57b05c19134f", qty: 5 }],
    };
    expect(gatePassSchema.safeParse(base).success).toBe(false);
    expect(gatePassSchema.safeParse({ ...base, exceptionReason: "Approved sample issue" }).success).toBe(true);
  });

  it("validates pricing override reasons before an order reaches the API", () => {
    const base = {
      customerId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
      warehouseId: "7603054e-279a-46fd-8a92-e3a29da459b4",
      orderDate: "2026-06-21",
      lines: [{ stockItemId: "064ebaed-5850-4a05-bb8a-57b05c19134f", qty: 1, unitPrice: 100 }],
    };
    expect(salesOrderSchema.safeParse({ ...base, pricingOverrideReason: "x" }).success).toBe(false);
    expect(salesOrderSchema.safeParse({ ...base, pricingOverrideReason: "Market-matched price" }).success).toBe(true);
  });

  it("requires sales order review reasons and receipt cancellation reasons", () => {
    expect(salesOrderReviewSchema.safeParse({ action: "approve" }).success).toBe(false);
    expect(salesOrderReviewSchema.safeParse({ action: "approve", reason: "Credit, price, and stock reservation checked" }).success).toBe(true);
    expect(customerReceiptCancelSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(customerReceiptCancelSchema.safeParse({ reason: "Duplicate bank entry posted by mistake" }).success).toBe(true);
  });
});

describe("customer CRM and credit controls", () => {
  it("requires tax identity and credit control fields before onboarding", () => {
    const base = {
      code: "CUST-001",
      name: "Aeden Retail Buyer",
      gstin: "32ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      region: "South Kerala",
      creditLimit: 0,
      customerTier: "Retailer",
      creditReviewDate: "2026-07-31",
      paymentTermsDays: 0,
    };
    expect(customerSchema.safeParse({ ...base, gstin: "", pan: "" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, creditLimit: undefined }).success).toBe(false);
    expect(customerSchema.safeParse(base).success).toBe(true);
  });

  it("locks customer classification to Aeden buyer classes", () => {
    expect(CUSTOMER_CLASSES).toContain("Wholesaler");
    expect(CUSTOMER_CLASSES).toContain("Retailer");
    expect(CUSTOMER_CLASSES).toContain("Modern Retail");
    expect(customerSchema.safeParse({
      code: "CUST-002",
      name: "Loose Buyer",
      gstin: "32ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      region: "South Kerala",
      creditLimit: 0,
      customerTier: "Good Party",
      creditReviewDate: "2026-07-31",
      paymentTermsDays: 0,
    }).success).toBe(false);
  });

  it("requires review reasons for customer approvals and KYC rejection", () => {
    expect(customerReviewSchema.safeParse({ action: "approve" }).success).toBe(false);
    expect(customerReviewSchema.safeParse({ action: "approve", reason: "Tax and credit reviewed" }).success).toBe(true);
    expect(
      customerKycReviewSchema.safeParse({
        docId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        action: "reject",
      }).success
    ).toBe(false);
    expect(
      customerKycReviewSchema.safeParse({
        docId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        action: "reject",
        reason: "GST certificate mismatch",
      }).success
    ).toBe(true);
  });
});

describe("ERP SOP center", () => {
  it("covers imported fruit cold-storage operating flows", () => {
    const ids = SOP_PLAYBOOKS.map((playbook) => playbook.id);
    expect(ids).toContain("customer-onboarding");
    expect(ids).toContain("inward-container");
    expect(ids).toContain("grading-repacking");
    expect(ids).toContain("fefo-outward");
    expect(ids).toContain("cold-chain-breach");
    expect(ids).toContain("receivables-credit-review");
    expect(SOP_PLAYBOOKS.every((playbook) => playbook.steps.length >= 3)).toBe(true);
    expect(SOP_PLAYBOOKS.every((playbook) => playbook.guardrails.length >= 3)).toBe(true);
  });
});

describe("financial redaction", () => {
  it("removes restricted values recursively from revision snapshots", () => {
    expect(redactRestrictedFinancialFields({
      floorPrice: 90,
      line: { costPrice: 70, marginPct: 12, unitPrice: 100 },
    })).toEqual({ line: { unitPrice: 100 } });
  });
});

describe("finance document controls", () => {
  it("requires valid invoice source and sane tax rate", () => {
    expect(
      issueSalesInvoiceSchema.safeParse({
        salesOrderId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        taxRatePct: 101,
      }).success
    ).toBe(false);

    expect(
      issueSalesInvoiceSchema.safeParse({
        salesOrderId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        taxRatePct: 5,
      }).success
    ).toBe(true);
  });

  it("forces credit notes and cancellations to carry reason trails", () => {
    expect(
      issueCreditNoteSchema.safeParse({
        salesInvoiceId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        amount: 100,
        reason: "",
      }).success
    ).toBe(false);

    expect(
      financeDocumentCancelSchema.safeParse({
        reason: "Duplicate finance entry",
      }).success
    ).toBe(true);
  });

  it("validates customer return lines and disposition before stock can be adjusted", () => {
    expect(
      postSalesReturnSchema.safeParse({
        salesOrderId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        reason: "Rejected by customer",
        lines: [
          {
            salesOrderLineId: "7603054e-279a-46fd-8a92-e3a29da459b4",
            qty: 0,
            disposition: "Restock",
          },
        ],
      }).success
    ).toBe(false);

    expect(
      postSalesReturnSchema.safeParse({
        salesOrderId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        reason: "Rejected by customer",
        lines: [
          {
            salesOrderLineId: "7603054e-279a-46fd-8a92-e3a29da459b4",
            qty: 2,
            disposition: "QualityHold",
          },
        ],
      }).success
    ).toBe(true);
  });
});

describe("finance close and reconciliation controls", () => {
  it("requires bank statement lines to carry a debit or credit value", () => {
    expect(
      bankStatementLineSchema.safeParse({
        bankName: "HDFC",
        description: "Customer receipt",
        debitAmount: 0,
        creditAmount: 0,
      }).success
    ).toBe(false);
    expect(
      bankStatementLineSchema.safeParse({
        bankName: "HDFC",
        description: "Customer receipt",
        creditAmount: 100,
      }).success
    ).toBe(true);
  });

  it("blocks imbalanced journal entries and accepts balanced postings", () => {
    const base = {
      narration: "Invoice posting",
      lines: [
        { accountCode: "AR", accountName: "Accounts Receivable", debitAmount: 100, creditAmount: 0 },
        { accountCode: "REV", accountName: "Sales Revenue", debitAmount: 0, creditAmount: 90 },
      ],
    };
    expect(journalEntrySchema.safeParse(base).success).toBe(false);
    expect(
      journalEntrySchema.safeParse({
        ...base,
        lines: [
          { accountCode: "AR", accountName: "Accounts Receivable", debitAmount: 100, creditAmount: 0 },
          { accountCode: "REV", accountName: "Sales Revenue", debitAmount: 0, creditAmount: 100 },
        ],
      }).success
    ).toBe(true);
  });

  it("requires finance close periods to use YYYY-MM and notes", () => {
    expect(financePeriodCloseSchema.safeParse({ periodKey: "2026", closeNotes: "x" }).success).toBe(false);
    expect(financePeriodCloseSchema.safeParse({ periodKey: "2026-07", closeNotes: "Month verified" }).success).toBe(true);
  });
});

describe("cold-chain controls", () => {
  it("validates temperature readings and task resolution notes", () => {
    expect(
      coldRoomReadingSchema.safeParse({
        warehouseId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        temperatureC: 100,
      }).success
    ).toBe(false);
    expect(
      coldRoomReadingSchema.safeParse({
        warehouseId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        temperatureC: 2.5,
        humidityPct: 85,
      }).success
    ).toBe(true);
    expect(
      temperatureTaskActionSchema.safeParse({
        taskId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        action: "resolve",
      }).success
    ).toBe(false);
    expect(
      temperatureTaskActionSchema.safeParse({
        taskId: "064ebaed-5850-4a05-bb8a-57b05c19134f",
        action: "resolve",
        resolutionNotes: "Moved affected pallet to CR-02 and supervisor approved release.",
      }).success
    ).toBe(true);
  });
});

describe("import validation", () => {
  it("maps common arrival sheet columns and flags missing required import identifiers", () => {
    const valid = mapRow(
      {
        "Container No": "MNBU9052800",
        "BL No": "BL-001",
        Supplier: "COSMOS GROUP",
        "Weight / Boxes": "13 KG / 1494 BOXES",
        ETA: "12/06/2026",
        Duty: "₹20,000",
      },
      7
    );

    expect(valid.errors).toEqual([]);
    expect(valid.containerNo).toBe("MNBU9052800");
    expect(valid.blNo).toBe("BL-001");
    expect(valid.perPackageWeight).toBe(13);
    expect(valid.noOfBoxes).toBe(1494);
    expect(valid.packageType).toBe("BOXES");
    expect(valid.customsDuty).toBe(20_000);

    const invalid = mapRow({ Supplier: "COSMOS GROUP" }, 8);
    expect(invalid.errors).toContain("Missing Container No");
    expect(invalid.errors).toContain("Missing BL No");
  });
});

describe("document upload validation", () => {
  const baseUpload = {
    orgId: "org-1",
    containerId: "container-1",
    type: "BillOfLading" as const,
    filePath: "org-1/container-1/BillOfLading/1710000000000_bl.pdf",
    fileName: "bl.pdf",
    fileSize: 1024,
  };

  it("accepts private storage metadata that matches the organisation, container and type", () => {
    expect(validateDocumentUploadMetadata(baseUpload)).toBeNull();
  });

  it("blocks public document URLs", () => {
    expect(
      validateDocumentUploadMetadata({
        ...baseUpload,
        fileUrl: "https://example.com/bl.pdf",
      })
    ).toContain("Public document URLs");
  });

  it("blocks unsafe paths, unsupported extensions and oversized files", () => {
    expect(
      validateDocumentUploadMetadata({
        ...baseUpload,
        filePath: "org-1/container-1/BillOfLading/../evil.pdf",
      })
    ).toContain("unsafe");

    expect(
      validateDocumentUploadMetadata({
        ...baseUpload,
        filePath: "org-1/container-1/BillOfLading/1710000000000_bl.exe",
        fileName: "bl.exe",
      })
    ).toContain("Only PDF");

    expect(
      validateDocumentUploadMetadata({
        ...baseUpload,
        fileSize: 26 * 1024 * 1024,
      })
    ).toContain("25 MB");
  });

  it("requires document records with uploaded files to include complete metadata", () => {
    expect(
      createDocumentSchema.safeParse({
        containerId: "container-1",
        type: "BillOfLading",
        filePath: baseUpload.filePath,
        status: "Uploaded",
      }).success
    ).toBe(true);

    expect(
      validateDocumentUploadMetadata({
        orgId: "org-1",
        containerId: "container-1",
        type: "BillOfLading",
        filePath: baseUpload.filePath,
      })
    ).toContain("file path, file name and file size");
  });
});

describe("document dossier downloads", () => {
  it("sanitises dossier document names while preserving useful business labels", () => {
    expect(
      dossierDocumentFileName({
        index: 1,
        type: "BillOfLading",
        docNo: "BL/001:ABC",
        status: "Verified",
        fileName: "original.PDF",
      })
    ).toBe("01_Bill_of_Lading_BL_001_ABC_Verified.PDF");
  });

  it("sanitises archive names and falls back to .bin when a source file has no extension", () => {
    expect(dossierArchiveName("MNBU9052800", "BL/001:ABC")).toBe(
      "MNBU9052800_BL_001_ABC_dossier.zip"
    );
    expect(extensionFromName("document-without-extension")).toBe(".bin");
  });
});

describe("rate limiting", () => {
  it("blocks requests after the configured window budget is exhausted", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});

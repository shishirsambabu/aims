import { describe, expect, it } from "vitest";

import { computeCost, computeProfit } from "@/lib/finance";
import {
  dossierArchiveName,
  dossierDocumentFileName,
  extensionFromName,
} from "@/lib/document-dossier";
import { paymentCanBePaid, paymentReviewBlocker } from "@/lib/payment-workflow";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import { validateDocumentUploadMetadata } from "@/lib/upload-security";
import { mapRow } from "@/lib/import/mapping";
import { createContainerSchema } from "@/lib/validations/container";
import { createDocumentSchema, updateDocumentSchema } from "@/lib/validations/document";
import { createPaymentSchema } from "@/lib/validations/payment";

describe("role permissions", () => {
  it("keeps financial visibility away from operations-only roles", () => {
    expect(can("clearing_agent", "financials.view")).toBe(false);
    expect(can("viewer", "financials.view")).toBe(false);
    expect(can("auditor", "financials.view")).toBe(true);
    expect(can("finance", "financials.view")).toBe(true);
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

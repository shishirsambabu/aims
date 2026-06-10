"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CONTAINER_STATUS_LABELS } from "@/lib/constants";
import { xlsxBlob } from "@/lib/exports/xlsx";
import type { ContainerListRow } from "@/lib/data/containers";

export function ExportButton({ rows }: { rows: ContainerListRow[] }) {
  async function exportXlsx() {
    const data = [
      [
        "Sl No",
        "Container No",
        "BL No",
        "Supplier",
        "Port",
        "Item",
        "Boxes",
        "Status",
        "Sale Value (INR)",
        "Profit (INR)",
        "Margin %",
        "Docs (x/9)",
      ],
      ...rows.map((r) => [
        r.slNo ?? "",
        r.containerNo,
        r.blNo,
        r.supplierName ?? "",
        r.port ?? "",
        r.item ?? "",
        r.noOfBoxes ?? "",
        CONTAINER_STATUS_LABELS[r.status] ?? r.status,
        r.saleValue ?? "",
        r.profit ?? "",
        r.marginPct ?? "",
        r.docScore,
      ]),
    ];
    const blob = await xlsxBlob([{ name: "Containers", rows: data }]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `AIMS-containers-${stamp}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" onClick={exportXlsx} disabled={rows.length === 0}>
      <Download className="h-4 w-4" /> Export
    </Button>
  );
}

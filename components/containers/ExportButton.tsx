"use client";

import * as XLSX from "xlsx";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CONTAINER_STATUS_LABELS } from "@/lib/constants";
import type { ContainerListRow } from "@/lib/data/containers";

export function ExportButton({ rows }: { rows: ContainerListRow[] }) {
  function exportXlsx() {
    const data = rows.map((r) => ({
      "Sl No": r.slNo ?? "",
      "Container No": r.containerNo,
      "BL No": r.blNo,
      Supplier: r.supplierName ?? "",
      Port: r.port ?? "",
      Item: r.item ?? "",
      Boxes: r.noOfBoxes ?? "",
      Status: CONTAINER_STATUS_LABELS[r.status] ?? r.status,
      "Sale Value (INR)": r.saleValue ?? "",
      "Profit (INR)": r.profit ?? "",
      "Margin %": r.marginPct ?? "",
      "Docs (x/9)": r.docScore,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Containers");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `AIMS-containers-${stamp}.xlsx`);
  }

  return (
    <Button variant="outline" onClick={exportXlsx} disabled={rows.length === 0}>
      <Download className="h-4 w-4" /> Export
    </Button>
  );
}

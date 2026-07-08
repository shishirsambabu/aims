"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { xlsxBlob } from "@/lib/exports/xlsx";

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Exports ALL rows matching the current URL filters by re-querying the list
 * API (ignoring pagination), then builds a client-side XLSX download.
 */
export function ExportXlsxButton<T>({
  endpoint,
  columns,
  filenamePrefix,
  sheetName,
  total,
}: {
  endpoint: string;
  columns: ExportColumn<T>[];
  filenamePrefix: string;
  sheetName: string;
  total: number;
}) {
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  async function exportXlsx() {
    setExporting(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      const qs = params.toString();
      const res = await fetch(`${endpoint}${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const body = (await res.json()) as { data: T[] };

      const data = [
        columns.map((c) => c.header),
        ...body.data.map((row) => columns.map((c) => c.value(row) ?? "")),
      ];
      const blob = await xlsxBlob([{ name: sheetName, rows: data }]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${filenamePrefix}-${stamp}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={exportXlsx}
      disabled={total === 0 || exporting}
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export
    </Button>
  );
}

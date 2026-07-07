"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import readXlsxFile from "read-excel-file/browser";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { mapSheetRows, type MappedRow } from "@/lib/import/mapping";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  warnings?: string[];
  warehouseAssigned?: number;
  warehouseMatched?: number;
  warehouseUnresolved?: number;
}

function externalIdSummary(row: MappedRow) {
  return [
    row.carrierExternalId ? `Carrier:${row.carrierExternalId}` : null,
    row.wmsExternalId ? `WMS:${row.wmsExternalId}` : null,
    row.erpExternalId ? `ERP:${row.erpExternalId}` : null,
    row.tallyExternalId ? `Tally:${row.tallyExternalId}` : null,
    row.icegateExternalId ? `ICEGATE:${row.icegateExternalId}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

export function ImportWizard({
  existingNos,
  existingBlNos,
}: {
  existingNos: string[];
  existingBlNos: string[];
}) {
  const router = useRouter();
  const existing = new Set(existingNos);
  const existingBl = new Set(existingBlNos);

  const [rows, setRows] = useState<MappedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    setResult(null);
    try {
      const sheets = await readXlsxFile(file);

      const merged: MappedRow[] = [];
      const seenNos = new Set<string>();
      const usedSheets: string[] = [];
      for (const sheet of sheets) {
            const mapped = mapSheetRows(sheet.data as unknown[][]);
            if (mapped.length === 0) continue;
            usedSheets.push(sheet.sheet);
        for (const row of mapped) {
          const key = row.containerNo?.toUpperCase() ?? "";
          if (key && seenNos.has(key)) continue;
          if (key) seenNos.add(key);
          merged.push({ ...row, rowNumber: merged.length + 2 });
        }
      }

      if (merged.length === 0) {
        toast.error(
          "No container rows found - check for a Container No or CNT No column"
        );
        return;
      }

      setRows(merged);
      setFileName(
        `${file.name} - ${usedSheets.length} sheet${usedSheets.length === 1 ? "" : "s"}`
      );
      toast.success(`Parsed ${merged.length} containers from ${file.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't parse that file - please upload a valid .xlsx file");
    }
  }

  const validRows = rows.filter(
    (row) =>
      row.containerNo &&
      row.blNo &&
      !existing.has(row.containerNo) &&
      !existingBl.has(row.blNo)
  );
  const dupCount = rows.filter(
    (row) =>
      row.containerNo &&
      row.blNo &&
      (existing.has(row.containerNo) || existingBl.has(row.blNo))
  ).length;
  const invalidCount = rows.filter((row) => !row.containerNo || !row.blNo).length;

  async function runImport() {
    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Import failed");
        return;
      }
      setResult(json.data);
      toast.success(`Imported ${json.data.imported} containers`);
      router.refresh();
    } catch {
      toast.error("Network error during import");
    } finally {
      setImporting(false);
    }
  }

  function downloadErrors() {
    if (!result) return;
    const csv = [
      "Row,Message",
      ...result.errors.map((error) =>
        `${error.row},"${error.message.replace(/"/g, "'")}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-alt/40 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-accent/30"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">
              Drop your tracker .xlsx here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              All sheets are scanned; columns are auto-mapped to AIMS fields.
            </p>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {rows.length > 0 && !result && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4 text-primary" /> {fileName}
              </span>
              <Stat label="Ready" value={validRows.length} tone="text-success" />
              <Stat label="Duplicates" value={dupCount} tone="text-warning" />
              <Stat
                label="Missing Container No"
                value={invalidCount}
                tone="text-danger"
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Row</TableHead>
                    <TableHead>Container No</TableHead>
                    <TableHead>BL No</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Sheet Status</TableHead>
                    <TableHead>External IDs</TableHead>
                    <TableHead>Boxes</TableHead>
                    <TableHead>Import Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((row) => {
                    const dup =
                      row.containerNo &&
                      row.blNo &&
                      (existing.has(row.containerNo) || existingBl.has(row.blNo));
                    const bad = !row.containerNo || !row.blNo;
                    return (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-financial text-muted-foreground">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell className="font-financial">
                          {row.containerNo ?? "-"}
                        </TableCell>
                        <TableCell className="font-financial text-muted-foreground">
                          {row.blNo ?? "-"}
                        </TableCell>
                        <TableCell>{row.supplierName ?? "-"}</TableCell>
                        <TableCell>{row.port ?? "-"}</TableCell>
                        <TableCell>{row.warehouseName ?? row.warehouseCode ?? "-"}</TableCell>
                        <TableCell>{row.sourceStatus ?? "-"}</TableCell>
                        <TableCell className="max-w-[18rem] text-xs text-muted-foreground">
                          {externalIdSummary(row) || "-"}
                        </TableCell>
                        <TableCell className="font-financial">
                          {row.noOfBoxes ?? "-"}
                        </TableCell>
                        <TableCell>
                          {bad ? (
                            <span className="text-xs text-danger">
                              Missing No / BL
                            </span>
                          ) : dup ? (
                            <span className="text-xs text-warning">Duplicate</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> New
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {rows.length > 10 && (
              <p className="text-xs text-muted-foreground">
                Showing first 10 of {rows.length} rows.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRows([])}
                disabled={importing}
              >
                Clear
              </Button>
              <Button
                onClick={runImport}
                disabled={importing || validRows.length === 0}
              >
                {importing && <Loader2 className="animate-spin" />}
                Import {validRows.length} containers
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-success" />
              <h3 className="font-heading text-lg font-semibold">
                Import complete
              </h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <Stat label="Imported" value={result.imported} tone="text-success" />
              <Stat label="Skipped" value={result.skipped} tone="text-warning" />
              <Stat label="Errors" value={result.errors.length} tone="text-danger" />
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  {result.errors.length} row(s) had issues
                </div>
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  <Download className="h-4 w-4" /> Download error report (CSV)
                </Button>
              </div>
            )}
            {result.warnings?.length ? (
              <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <p className="font-medium">Import warnings</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {typeof result.warehouseAssigned === "number" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Warehouse matched" value={result.warehouseMatched ?? 0} tone="text-success" />
                <Stat label="Warehouse assigned" value={result.warehouseAssigned ?? 0} tone="text-primary" />
                <Stat label="Warehouse unresolved" value={result.warehouseUnresolved ?? 0} tone="text-warning" />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => router.push("/containers")}>
                View Containers
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRows([]);
                  setResult(null);
                }}
              >
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <span className="rounded-md border border-border bg-surface px-3 py-1 text-sm">
      <span className={cn("font-financial font-bold", tone)}>{value}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

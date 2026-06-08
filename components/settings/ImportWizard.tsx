"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
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
import { mapRows, type MappedRow } from "@/lib/import/mapping";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export function ImportWizard({ existingNos }: { existingNos: string[] }) {
  const router = useRouter();
  const existing = new Set(existingNos);

  const [rows, setRows] = useState<MappedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(file: File) {
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, {
          type: "binary",
          cellDates: true,
        });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
        });
        const mapped = mapRows(raw);
        if (mapped.length === 0) {
          toast.error("No data rows found in the sheet");
          return;
        }
        setRows(mapped);
        setFileName(file.name);
        toast.success(`Parsed ${mapped.length} rows from ${file.name}`);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't parse that file — is it a valid .xlsx?");
      }
    };
    reader.readAsBinaryString(file);
  }

  const validRows = rows.filter(
    (r) => r.containerNo && !existing.has(r.containerNo)
  );
  const dupCount = rows.filter(
    (r) => r.containerNo && existing.has(r.containerNo)
  ).length;
  const invalidCount = rows.filter((r) => !r.containerNo).length;

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
      ...result.errors.map((e) => `${e.row},"${e.message.replace(/"/g, "'")}"`),
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
      {/* Dropzone */}
      <Card>
        <CardContent className="pt-6">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-alt/40 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-accent/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">
              Drop your tracker .xlsx here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              First sheet is read; columns are auto-mapped to AIMS fields.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {/* Preview */}
      {rows.length > 0 && !result && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4 text-primary" /> {fileName}
              </span>
              <Stat label="Ready" value={validRows.length} tone="text-success" />
              <Stat label="Duplicates" value={dupCount} tone="text-warning" />
              <Stat label="Missing Container No" value={invalidCount} tone="text-danger" />
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
                    <TableHead>Boxes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((r) => {
                    const dup = r.containerNo && existing.has(r.containerNo);
                    const bad = !r.containerNo;
                    return (
                      <TableRow key={r.rowNumber}>
                        <TableCell className="font-financial text-muted-foreground">
                          {r.rowNumber}
                        </TableCell>
                        <TableCell className="font-financial">
                          {r.containerNo ?? "—"}
                        </TableCell>
                        <TableCell className="font-financial text-muted-foreground">
                          {r.blNo ?? "—"}
                        </TableCell>
                        <TableCell>{r.supplierName ?? "—"}</TableCell>
                        <TableCell>{r.port ?? "—"}</TableCell>
                        <TableCell className="font-financial">
                          {r.noOfBoxes ?? "—"}
                        </TableCell>
                        <TableCell>
                          {bad ? (
                            <span className="text-xs text-danger">Missing No</span>
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
              <Button variant="outline" onClick={() => setRows([])} disabled={importing}>
                Clear
              </Button>
              <Button onClick={runImport} disabled={importing || validRows.length === 0}>
                {importing && <Loader2 className="animate-spin" />}
                Import {validRows.length} containers
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
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

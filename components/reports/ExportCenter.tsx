import { Download, FileSpreadsheet, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function withFormat(params: { from?: string; to?: string }, format: "xlsx" | "csv") {
  const sp = new URLSearchParams();
  sp.set("format", format);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  return `/api/reports/management?${sp.toString()}`;
}

export function ExportCenter({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="label-caps">Phase 23 Export Center</p>
          <h3 className="mt-1 font-heading text-lg font-semibold">
            Management report pack
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Export summary, supplier performance, port performance and AP aging
            using the current report date filters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={withFormat({ from, to }, "xlsx")}>
              <FileSpreadsheet className="h-4 w-4" /> Excel Pack
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={withFormat({ from, to }, "csv")}>
              <Download className="h-4 w-4" /> CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/reports/exports">
              <FileText className="h-4 w-4" /> Export Center
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

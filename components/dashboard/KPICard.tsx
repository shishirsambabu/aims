import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "border-t-primary",
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: string;
  valueClass?: string;
}) {
  return (
    <Card className={cn("border-t-4", accent)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("font-financial mt-2 text-2xl font-bold", valueClass)}>
              {value}
            </p>
            {hint && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {hint}
              </p>
            )}
          </div>
          <div className="rounded-md bg-surface-alt p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

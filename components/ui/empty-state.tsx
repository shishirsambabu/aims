import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-background/70 px-6 py-10 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-2xl bg-primary/10 p-3 text-primary ring-1 ring-primary/15">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-heading text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

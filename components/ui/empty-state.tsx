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
        "mx-auto flex max-w-md flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-alt/40 px-6 py-10 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-3 rounded-md bg-accent p-2.5 text-accent-foreground">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-heading text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

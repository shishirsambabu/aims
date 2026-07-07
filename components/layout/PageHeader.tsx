import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex flex-col gap-3 border-b border-border bg-surface/95 px-5 py-3.5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between md:px-6",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 max-w-3xl truncate text-[13px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

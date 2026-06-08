import { Construction } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";

interface ComingSoonProps {
  title: string;
  description?: string;
  phase: string;
}

export function ComingSoon({ title, description, phase }: ComingSoonProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <div className="rounded-full bg-surface-alt p-4 text-primary">
          <Construction className="h-8 w-8" />
        </div>
        <h2 className="font-heading text-lg font-semibold">Coming in {phase}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This module is scaffolded and on the build roadmap. The layout,
          routing and design system are ready for it.
        </p>
      </div>
    </div>
  );
}

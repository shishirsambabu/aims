"use client";

import { useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintBar({ backHref }: { backHref: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between print:hidden">
      <Button variant="outline" size="sm" onClick={() => router.push(backHref)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print / Save PDF
      </Button>
    </div>
  );
}

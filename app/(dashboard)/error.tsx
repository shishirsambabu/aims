"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDbError = /reach database server|P1001|ECONNREFUSED|ETIMEDOUT/i.test(
    error.message
  );

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-danger/10 p-4 text-danger">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="font-heading text-xl font-bold">
        {isDbError ? "Can't reach the database" : "Something went wrong"}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {isDbError ? (
          <>
            The app can&apos;t connect to Supabase. Set <code>DATABASE_URL</code>{" "}
            to your Supabase <strong>connection pooler</strong> string (host{" "}
            <code>aws-0-&lt;region&gt;.pooler.supabase.com</code>, port{" "}
            <code>6543</code>) — not the direct <code>db.*.supabase.co:5432</code>{" "}
            host — then run <code>npm run db:deploy</code> and restart the dev
            server.
          </>
        ) : (
          "An unexpected error occurred. You can try again, or check the server logs for details."
        )}
      </p>
      <Button onClick={reset}>
        <RefreshCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}

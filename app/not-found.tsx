import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        <FileQuestion className="h-8 w-8" />
      </div>
      <div>
        <h1 className="font-heading text-xl font-bold">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-dark"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

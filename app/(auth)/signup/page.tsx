import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND_SHORT_NAME } from "@/lib/branding";

export default function SignupPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-bold">Invite-only access</h2>
        <p className="text-sm text-muted-foreground">
          {BRAND_SHORT_NAME} accounts are created by an administrator. Contact the Aeden team if you need access.
        </p>
      </div>
      <Button asChild className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { MfaManager } from "@/components/settings/MfaManager";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  await requireSession();

  return (
    <div>
      <PageHeader
        title="Security"
        description="Two-factor authentication for your account. Recommended for every role; will become mandatory for admin, GM, and finance."
      />
      <div className="p-6">
        <MfaManager />
      </div>
    </div>
  );
}

import Link from "next/link";
import { Package, FileText, CreditCard, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/containers/StatusBadge";
import { requireSession } from "@/lib/auth";
import { searchAll, type SearchResults } from "@/lib/data/search";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const q = (params.q ?? "").trim();

  let results: SearchResults = { containers: [], documents: [], payments: [] };
  if (q) {
    try {
      results = await searchAll(session.orgId, q);
    } catch {
      /* DB unreachable — show empty */
    }
  }
  const total =
    results.containers.length +
    results.documents.length +
    results.payments.length;

  return (
    <div>
      <PageHeader
        title="Search"
        description={q ? `Results for “${q}”` : "Search across containers, documents and payments."}
      />
      <div className="space-y-6 p-6">
        {!q ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Search className="h-8 w-8" />
            <p>Type a Container No, BL No, Doc No, item or reference above.</p>
          </div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matches for “{q}”.
          </p>
        ) : (
          <>
            {results.containers.length > 0 && (
              <Section title="Containers" icon={Package} count={results.containers.length}>
                {results.containers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/containers/${c.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-surface-alt/40"
                  >
                    <div>
                      <p className="font-financial text-sm font-medium">
                        {c.containerNo}{" "}
                        <span className="text-muted-foreground">· BL {c.blNo}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{c.supplier ?? "—"}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </Section>
            )}
            {results.documents.length > 0 && (
              <Section title="Documents" icon={FileText} count={results.documents.length}>
                {results.documents.map((d) => (
                  <Link
                    key={d.id}
                    href={`/containers/${d.containerId}`}
                    className="flex items-center justify-between py-2.5 hover:bg-surface-alt/40"
                  >
                    <p className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[d.type]}</p>
                    <p className="font-financial text-xs text-muted-foreground">
                      {d.docNo ?? "—"} · {d.containerNo ?? ""}
                    </p>
                  </Link>
                ))}
              </Section>
            )}
            {results.payments.length > 0 && (
              <Section title="Payments" icon={CreditCard} count={results.payments.length}>
                {results.payments.map((p) => (
                  <Link
                    key={p.id}
                    href="/payments"
                    className="flex items-center justify-between py-2.5 hover:bg-surface-alt/40"
                  >
                    <p className="text-sm font-medium">{p.containerNo ?? "—"}</p>
                    <p className="font-financial text-xs text-muted-foreground">
                      {p.currency} {p.amount.toLocaleString()} · {p.reference ?? "—"}
                    </p>
                  </Link>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof Package;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-2 flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          <span className="font-financial rounded-full bg-surface-alt px-2 py-0.5 text-xs text-muted-foreground">
            {count}
          </span>
        </div>
        <div className="divide-y divide-border">{children}</div>
      </CardContent>
    </Card>
  );
}

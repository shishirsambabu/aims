import { PageHeader } from "@/components/layout/PageHeader";
import { ItemManager } from "@/components/settings/ItemManager";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listItems, type ItemRow } from "@/lib/data/items";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const session = await requireSession();

  let items: ItemRow[] = [];
  let loadError = false;
  try {
    items = await listItems(session.orgId, { includeInactive: true });
  } catch (err) {
    console.error("[settings/items] load failed", err);
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Items / Products"
        description="The single source of truth for what you trade: codes, varieties, grades, HSN codes and default UoM. Containers, stock lots and price lists link here."
      />
      <div className="p-6">
        {loadError ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-muted-foreground">
            Couldn&apos;t load the item master. Check the database connection and retry.
          </div>
        ) : (
          <ItemManager
            initialItems={items}
            canWrite={can(session.role, "masterdata.write")}
          />
        )}
      </div>
    </div>
  );
}

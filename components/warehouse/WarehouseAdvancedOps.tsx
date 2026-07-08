"use client";

import { useMemo, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  Gauge,
  PackageCheck,
  Printer,
  QrCode,
  Scale,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import type { GatePassRow } from "@/lib/data/dispatch";
import type { StockItemRow, WarehouseInwardContainerRow } from "@/lib/data/stock";
import type {
  WarehouseAdvancedOpsRow,
  WarehouseLocationRow,
} from "@/lib/data/warehouse-ops";
import type { WarehouseRecord } from "@/lib/data/warehouses";

type WarehouseSection = "inward" | "processing" | "outward";

interface WarehouseAdvancedOpsProps {
  section: WarehouseSection;
  advancedOps: WarehouseAdvancedOpsRow;
  warehouses: WarehouseRecord[];
  locations: WarehouseLocationRow[];
  stock: StockItemRow[];
  inwardContainers: WarehouseInwardContainerRow[];
  gatePasses: GatePassRow[];
  canManage: boolean;
}

const SECTION_TABS: Record<WarehouseSection, string[]> = {
  inward: ["dock", "scan", "putaway", "capacity"],
  processing: ["qc", "repacking", "productivity", "exceptions", "claims"],
  outward: ["loading", "productivity", "exceptions", "claims", "scan"],
};

const TAB_META: Record<string, { label: string; icon: typeof CalendarClock }> = {
  dock: { label: "Dock calendar", icon: CalendarClock },
  scan: { label: "Scan + labels", icon: QrCode },
  putaway: { label: "Directed putaway", icon: PackageCheck },
  qc: { label: "QC sampling", icon: ClipboardCheck },
  repacking: { label: "Repacking WOs", icon: Scale },
  productivity: { label: "Shift productivity", icon: Gauge },
  capacity: { label: "Cold-room capacity", icon: Gauge },
  loading: { label: "Loading docs", icon: Truck },
  exceptions: { label: "Exception approvals", icon: ShieldCheck },
  claims: { label: "Supplier claims", icon: FileText },
};

function defaultWarehouseId(warehouses: WarehouseRecord[]) {
  return warehouses[0]?.id ?? "";
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function datetimeInput(hoursFromNow = 0) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function numberFormat(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export function WarehouseAdvancedOps({
  section,
  advancedOps,
  warehouses,
  locations,
  stock,
  inwardContainers,
  gatePasses,
  canManage,
}: WarehouseAdvancedOpsProps) {
  const router = useRouter();
  const tabs = SECTION_TABS[section];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [scanQuery, setScanQuery] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(defaultWarehouseId(warehouses));
  const [submitting, setSubmitting] = useState(false);

  const selectedWarehouseLocations = useMemo(
    () => locations.filter((location) => location.warehouseId === selectedWarehouseId),
    [locations, selectedWarehouseId]
  );

  const scanResult = useMemo(() => {
    const query = scanQuery.trim().toLowerCase();
    if (!query) return null;
    const lot = stock.find((item) =>
      [item.id, item.lotNo, item.palletNo, item.containerNo, item.blNo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
    if (lot) {
      return {
        type: "Stock lot",
        title: `${lot.item}${lot.grade ? ` / ${lot.grade}` : ""}`,
        code: lot.lotNo ?? lot.id.slice(0, 8),
        detail: `${lot.containerNo} | ${lot.warehouseName} | ${numberFormat(lot.qtyAvailable)} ${lot.uom}`,
      };
    }
    const inward = inwardContainers.find((container) =>
      [container.containerNo, container.blNo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
    if (inward) {
      return {
        type: "Inbound container",
        title: inward.containerNo,
        code: inward.blNo,
        detail: `${inward.status} | ${inward.warehouse?.name ?? "No warehouse"} | ${inward.item ?? "Item pending"}`,
      };
    }
    const gatePass = gatePasses.find((pass) =>
      [pass.gatePassNo, pass.vehicleNo, pass.vehicleSealNo, pass.salesOrderNo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
    if (gatePass) {
      return {
        type: "Gate pass",
        title: gatePass.gatePassNo,
        code: gatePass.vehicleSealNo ?? gatePass.vehicleNo ?? "seal pending",
        detail: `${gatePass.status} | ${gatePass.customerName ?? "Customer pending"} | ${numberFormat(gatePass.totalQty)} units`,
      };
    }
    return { type: "No match", title: "Nothing found", code: scanQuery, detail: "Try lot, pallet, container, BL, gate pass, vehicle, or seal." };
  }, [gatePasses, inwardContainers, scanQuery, stock]);

  const productivityByRole = useMemo(() => {
    const map = new Map<string, { qty: number; hours: number; workers: Set<string> }>();
    advancedOps.productivityLogs.forEach((row) => {
      const current = map.get(row.role) ?? { qty: 0, hours: 0, workers: new Set<string>() };
      current.qty += row.qtyHandled;
      current.hours += row.hoursWorked;
      current.workers.add(row.workerName);
      map.set(row.role, current);
    });
    return Array.from(map.entries()).map(([role, row]) => ({
      role,
      qty: row.qty,
      hours: row.hours,
      workers: row.workers.size,
      uph: row.hours > 0 ? row.qty / row.hours : 0,
    }));
  }, [advancedOps.productivityLogs]);

  const capacityRows = useMemo(() => {
    return locations
      .filter((location) => location.type === "Room" || location.type === "Zone" || location.type === "Bin")
      .map((location) => {
        const qty = stock
          .filter((item) => item.locationId === location.id)
          .reduce((sum, item) => sum + item.qtyAvailable + item.qtyReserved, 0);
        const capacity = location.capacityUnits ?? 0;
        const utilization = capacity > 0 ? Math.round((qty / capacity) * 100) : 0;
        return { ...location, qty, capacity, utilization };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }, [locations, stock]);

  const submit = async (event: FormEvent<HTMLFormElement>, successMessage: string) => {
    event.preventDefault();
    if (!canManage) {
      toast.error("You do not have permission to change warehouse controls.");
      return;
    }
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    setSubmitting(true);
    try {
      const response = await fetch("/api/warehouse-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Action failed");
      toast.success(successMessage);
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const patchAction = async (payload: Record<string, unknown>, successMessage: string) => {
    if (!canManage) {
      toast.error("You do not have permission to change warehouse controls.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/warehouse-ops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Action failed");
      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const printGateDocument = (pass: GatePassRow) => {
    const lines = pass.lines
      .map((line) => `${line.item}${line.grade ? ` ${line.grade}` : ""}: ${numberFormat(line.qtyPlanned)} ${line.uom}`)
      .join("<br />");
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>${pass.gatePassNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #10213f; }
            h1 { color: #0070D2; margin-bottom: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
            .box { border: 1px solid #b8c4d8; border-radius: 12px; padding: 12px; }
            .label { font-size: 11px; color: #61708a; text-transform: uppercase; letter-spacing: .08em; }
            .sign { height: 70px; border-bottom: 1px solid #10213f; }
          </style>
        </head>
        <body>
          <h1>AIMS Gate Document</h1>
          <p>Aeden International Management System | ${pass.gatePassNo}</p>
          <div class="grid">
            <div class="box"><div class="label">Customer</div>${pass.customerName ?? "-"}</div>
            <div class="box"><div class="label">Vehicle / Driver</div>${pass.vehicleNo ?? "-"} / ${pass.driverName ?? "-"}</div>
            <div class="box"><div class="label">Seal No</div>${pass.vehicleSealNo ?? "Pending"}</div>
            <div class="box"><div class="label">Route / Beat</div>${pass.routeName ?? "-"} / ${pass.beatName ?? "-"}</div>
            <div class="box"><div class="label">Delivery Instructions</div>${pass.deliveryInstructions ?? "-"}</div>
            <div class="box"><div class="label">Return Assets</div>Crates ${pass.returnCratesPlanned}, Pallets ${pass.returnPalletsPlanned}</div>
          </div>
          <div class="box"><div class="label">Loaded Items</div>${lines || "-"}</div>
          <div class="grid">
            <div><div class="sign"></div><p>Warehouse/Billing</p></div>
            <div><div class="sign"></div><p>Security/Driver</p></div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-caps">Cold-storage ERP controls</p>
          <h2 className="font-heading text-2xl font-semibold">Operate the warehouse with enforceable workflows.</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Dock scheduling, scans, putaway rules, QC, repacking, productivity, capacity, loading documents, exceptions, and supplier claims now live in the ERP flow.
          </p>
        </div>
        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
          <SelectTrigger className="w-full lg:w-[260px]">
            <SelectValue placeholder="Select warehouse" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name} ({warehouse.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const meta = TAB_META[tab];
          const Icon = meta.icon;
          return (
            <Button
              key={tab}
              type="button"
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="shrink-0"
            >
              <Icon className="mr-2 h-4 w-4" />
              {meta.label}
            </Button>
          );
        })}
      </div>

      <div className="mt-5">
        {activeTab === "dock" ? (
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Book unloading bay</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={(event) => submit(event, "Dock appointment created")}>
                  <input type="hidden" name="kind" value="dock-appointment" />
                  <input type="hidden" name="warehouseId" value={selectedWarehouseId} />
                  <FormField label="Container">
                    <Select name="containerId">
                      <SelectTrigger><SelectValue placeholder="Optional inbound container" /></SelectTrigger>
                      <SelectContent>
                        {inwardContainers
                          .filter((row) => !selectedWarehouseId || row.warehouse?.id === selectedWarehouseId)
                          .map((row) => (
                            <SelectItem key={row.id} value={row.id}>{row.containerNo} | {row.blNo}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput name="bayCode" label="Bay" placeholder="Dock-01" required />
                    <TextInput name="vehicleNo" label="Vehicle" placeholder="KL-07..." />
                  </div>
                  <TextInput name="driverName" label="Driver" placeholder="Driver name" />
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput name="scheduledStart" label="Start" type="datetime-local" defaultValue={datetimeInput()} required />
                    <TextInput name="scheduledEnd" label="End" type="datetime-local" defaultValue={datetimeInput(2)} required />
                  </div>
                  <TextInput name="notes" label="Dock notes" placeholder="Labor, unloading method, special care" />
                  <Button disabled={submitting || !canManage} className="w-full">Schedule bay</Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Dock calendar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {advancedOps.dockAppointments.length === 0 ? <EmptyLine text="No dock appointments yet." /> : null}
                {advancedOps.dockAppointments.map((row) => (
                  <ActionRow
                    key={row.id}
                    title={`${row.appointmentNo} | ${row.bayCode}`}
                    subtitle={`${formatDate(row.scheduledStart)} -> ${formatDate(row.scheduledEnd)} | ${row.containerNo ?? "No container linked"}`}
                    badge={row.status}
                    actions={[
                      { label: "Start", onClick: () => patchAction({ kind: "dock-appointment", id: row.id, status: "Unloading" }, "Unloading started") },
                      { label: "Complete", onClick: () => patchAction({ kind: "dock-appointment", id: row.id, status: "Completed" }, "Dock appointment completed") },
                    ]}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "scan" ? (
          <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader><CardTitle>Handheld scan mode</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <TextInput label="Scan lot / pallet / BL / gate pass" value={scanQuery} onChange={(event) => setScanQuery(event.target.value)} placeholder="Scan or type code" autoFocus />
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                  {scanResult ? (
                    <>
                      <Badge>{scanResult.type}</Badge>
                      <h3 className="mt-2 font-heading text-xl font-semibold">{scanResult.title}</h3>
                      <p className="font-financial mt-1 text-sm">{scanResult.code}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{scanResult.detail}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ready for handheld barcode/QR input.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Lot labels</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {stock.slice(0, 9).map((lot) => (
                  <div key={lot.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-heading font-semibold">{lot.item}</p>
                        <p className="text-xs text-muted-foreground">{lot.grade ?? "No grade"} | {lot.containerNo}</p>
                      </div>
                      <div className="grid h-14 w-14 place-items-center rounded-xl border border-primary/30 bg-primary/10">
                        <QrCode className="h-7 w-7 text-primary" />
                      </div>
                    </div>
                    <p className="font-financial mt-3 text-lg">{lot.lotNo ?? lot.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">FEFO: {lot.expiryDate ? formatDate(lot.expiryDate) : "No expiry"}</p>
                    <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" /> Print label
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "putaway" ? (
          <PutawayPanel
            canManage={canManage}
            selectedWarehouseId={selectedWarehouseId}
            locations={selectedWarehouseLocations}
            stock={stock}
            rules={advancedOps.putawayRules}
            submitting={submitting}
            submit={submit}
          />
        ) : null}

        {activeTab === "qc" ? (
          <QcPanel canManage={canManage} stock={stock} data={advancedOps} submit={submit} submitting={submitting} />
        ) : null}

        {activeTab === "repacking" ? (
          <RepackingPanel canManage={canManage} stock={stock} data={advancedOps} submit={submit} patchAction={patchAction} submitting={submitting} />
        ) : null}

        {activeTab === "productivity" ? (
          <ProductivityPanel
            canManage={canManage}
            warehouses={warehouses}
            selectedWarehouseId={selectedWarehouseId}
            data={advancedOps}
            summary={productivityByRole}
            submit={submit}
            submitting={submitting}
          />
        ) : null}

        {activeTab === "capacity" ? (
          <Card>
            <CardHeader><CardTitle>Cold-room capacity by room / zone / bin</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {capacityRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading font-semibold">{row.code}</p>
                      <p className="text-sm text-muted-foreground">{row.name} | {row.type}</p>
                    </div>
                    <Badge variant={row.utilization >= 95 ? "danger" : row.utilization >= 80 ? "warning" : "success"}>
                      {row.utilization}%
                    </Badge>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-surface-alt">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(row.utilization, 100)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{numberFormat(row.qty)} used / {numberFormat(row.capacity)} capacity units</p>
                  <p className="mt-1 text-xs text-muted-foreground">Temp: {row.temperatureMinC ?? "-"}C to {row.temperatureMaxC ?? "-"}C</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "loading" ? (
          <Card>
            <CardHeader><CardTitle>Vehicle loading checklist and gate document linkage</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {gatePasses.map((pass) => (
                <ActionRow
                  key={pass.id}
                  title={`${pass.gatePassNo} | ${pass.customerName ?? "No customer"}`}
                  subtitle={`Seal: ${pass.vehicleSealNo ?? "pending"} | Photo: ${pass.loadingPhotoRef ? "attached" : "pending"} | POD: ${pass.podRef ? "received" : "pending"}`}
                  badge={pass.status}
                  tone={!pass.vehicleSealNo || !pass.loadingPhotoRef ? "warning" : pass.podRef ? "success" : "default"}
                  actions={[{ label: "Print gate document", onClick: () => printGateDocument(pass) }]}
                />
              ))}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "exceptions" ? (
          <ExceptionPanel
            canManage={canManage}
            warehouses={warehouses}
            selectedWarehouseId={selectedWarehouseId}
            data={advancedOps}
            submit={submit}
            patchAction={patchAction}
            submitting={submitting}
          />
        ) : null}

        {activeTab === "claims" ? (
          <ClaimsPanel
            canManage={canManage}
            stock={stock}
            inwardContainers={inwardContainers}
            data={advancedOps}
            submit={submit}
            patchAction={patchAction}
            submitting={submitting}
          />
        ) : null}
      </div>
    </section>
  );
}

function PutawayPanel({
  canManage,
  selectedWarehouseId,
  locations,
  stock,
  rules,
  submitting,
  submit,
}: {
  canManage: boolean;
  selectedWarehouseId: string;
  locations: WarehouseLocationRow[];
  stock: StockItemRow[];
  rules: WarehouseAdvancedOpsRow["putawayRules"];
  submitting: boolean;
  submit: (event: FormEvent<HTMLFormElement>, successMessage: string) => void;
}) {
  const suggestions = stock.slice(0, 12).map((lot) => {
    const match = rules.find((rule) => {
      const productMatch = lot.item.toLowerCase().includes(rule.product.toLowerCase());
      const varietyMatch = !rule.variety || lot.variety?.toLowerCase() === rule.variety.toLowerCase();
      const ripeningMatch = !rule.ripeningState || lot.ripeningState?.toLowerCase() === rule.ripeningState.toLowerCase();
      const tempMatch =
        lot.temperatureAtReceiptC == null ||
        ((rule.temperatureMinC == null || lot.temperatureAtReceiptC >= rule.temperatureMinC) &&
          (rule.temperatureMaxC == null || lot.temperatureAtReceiptC <= rule.temperatureMaxC));
      return productMatch && varietyMatch && ripeningMatch && tempMatch && rule.isActive;
    });
    return { lot, match };
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader><CardTitle>Create putaway rule</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => submit(event, "Putaway rule created")}>
            <input type="hidden" name="kind" value="putaway-rule" />
            <input type="hidden" name="warehouseId" value={selectedWarehouseId} />
            <FormField label="Target room / zone / bin">
              <Select name="locationId" required>
                <SelectTrigger><SelectValue placeholder="Choose location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>{location.code} | {location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="product" label="Product" placeholder="Apple" required />
              <TextInput name="variety" label="Variety" placeholder="Royal Gala" />
            </div>
            <TextInput name="ripeningState" label="Ripening stage" placeholder="Hard green / ripe / turning" />
            <div className="grid grid-cols-3 gap-3">
              <TextInput name="temperatureMinC" label="Min C" type="number" step="0.1" />
              <TextInput name="temperatureMaxC" label="Max C" type="number" step="0.1" />
              <TextInput name="fefoMaxDays" label="FEFO days" type="number" />
            </div>
            <TextInput name="priority" label="Priority" type="number" defaultValue="100" />
            <TextInput name="notes" label="Rule notes" placeholder="Store away from ethylene, ripening room, etc." />
            <Button disabled={submitting || !canManage} className="w-full">Save rule</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Directed putaway suggestions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {suggestions.map(({ lot, match }) => (
            <div key={lot.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-semibold">{lot.item} {lot.variety ?? ""}</p>
                  <p className="text-xs text-muted-foreground">{lot.containerNo} | {lot.lotNo ?? lot.id.slice(0, 8)} | FEFO {lot.fefoDueInDays ?? "-"} days</p>
                </div>
                <Badge variant={match ? "success" : "warning"}>{match ? "Rule hit" : "Needs rule"}</Badge>
              </div>
              <p className="mt-2 text-sm">{match ? `Put away to ${match.locationCode} (${match.locationName})` : "No matching rule. Create product/ripening/temperature rule before receiving scale-up."}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function QcPanel({ canManage, stock, data, submit, submitting }: {
  canManage: boolean;
  stock: StockItemRow[];
  data: WarehouseAdvancedOpsRow;
  submit: (event: FormEvent<HTMLFormElement>, successMessage: string) => void;
  submitting: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader><CardTitle>Open QC sampling plan</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => submit(event, "QC sampling plan created")}>
            <input type="hidden" name="kind" value="qc-sampling-plan" />
            <StockSelect stock={stock} name="stockItemId" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="sampleSize" label="Sample size" type="number" required />
              <TextInput name="defectCount" label="Defect count" type="number" defaultValue="0" />
            </div>
            <FormField label="Defect class">
              <Select name="defectClass">
                <SelectTrigger><SelectValue placeholder="Select defect" /></SelectTrigger>
                <SelectContent>
                  {["Bruising", "Mold", "Softness", "Chilling injury", "Short weight", "Size variance", "Packaging damage"].map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Severity">
              <Select name="severity" defaultValue="Normal">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Normal", "Minor", "Major", "Critical"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <TextInput name="photoRef" label="QC photo/document ref" placeholder="Storage path or URL" />
            <TextInput name="disposition" label="Disposition" placeholder="Release / Hold / Claim / Dump" defaultValue="Pending" />
            <Button disabled={submitting || !canManage} className="w-full">Create QC plan</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>QC defect board</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.qcSamplingPlans.map((row) => (
            <ActionRow
              key={row.id}
              title={`${row.planNo} | ${row.item}${row.grade ? ` / ${row.grade}` : ""}`}
              subtitle={`${row.defectClass ?? "No defect class"} | ${row.defectCount}/${row.sampleSize} defects | ${row.containerNo}`}
              badge={row.severity}
              tone={row.severity === "Critical" || row.severity === "Major" ? "danger" : row.status === "Closed" ? "success" : "default"}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RepackingPanel({ canManage, stock, data, submit, patchAction, submitting }: {
  canManage: boolean;
  stock: StockItemRow[];
  data: WarehouseAdvancedOpsRow;
  submit: (event: FormEvent<HTMLFormElement>, successMessage: string) => void;
  patchAction: (payload: Record<string, unknown>, successMessage: string) => void;
  submitting: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader><CardTitle>Create repacking work order</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => submit(event, "Repacking work order created")}>
            <input type="hidden" name="kind" value="repacking-work-order" />
            <StockSelect stock={stock} name="sourceStockItemId" />
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="outputItem" label="Output item" placeholder="Apple repack" required />
              <TextInput name="outputGrade" label="Output grade" placeholder="A / B / C" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="packSpec" label="Pack spec" placeholder="5 kg carton" />
              <TextInput name="plannedInputQty" label="Input qty" type="number" step="0.001" required />
            </div>
            <TextInput name="notes" label="Work instructions" placeholder="Sort criteria, sticker/label, pack table" />
            <Button disabled={submitting || !canManage} className="w-full">Create work order</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Yield and labor tracking</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.repackingWorkOrders.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-semibold">{row.workOrderNo} | {row.outputItem}</p>
                  <p className="text-xs text-muted-foreground">From {row.sourceItem} {row.sourceGrade ?? ""} | {row.containerNo}</p>
                </div>
                <Badge variant={row.status === "Completed" ? "success" : "warning"}>{row.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Planned input {numberFormat(row.plannedInputQty)} | Output {numberFormat(row.outputQty)} | Wastage {numberFormat(row.wastageQty)} | Yield {row.yieldPct ?? "-"}%</p>
              {row.status !== "Completed" ? (
                <form
                  className="mt-3 grid gap-2 md:grid-cols-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
                    patchAction({ ...form, kind: "repacking-work-order", id: row.id, action: "complete" }, "Repacking completed and child lot created");
                  }}
                >
                  <Input name="actualInputQty" type="number" step="0.001" placeholder="Actual input" required />
                  <Input name="outputQty" type="number" step="0.001" placeholder="Output qty" required />
                  <Input name="wastageQty" type="number" step="0.001" placeholder="Wastage" defaultValue="0" />
                  <Input name="laborHours" type="number" step="0.1" placeholder="Labor hrs" />
                  <Button disabled={submitting || !canManage}>Complete</Button>
                </form>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductivityPanel({ canManage, warehouses, selectedWarehouseId, data, summary, submit, submitting }: {
  canManage: boolean;
  warehouses: WarehouseRecord[];
  selectedWarehouseId: string;
  data: WarehouseAdvancedOpsRow;
  summary: { role: string; qty: number; hours: number; workers: number; uph: number }[];
  submit: (event: FormEvent<HTMLFormElement>, successMessage: string) => void;
  submitting: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader><CardTitle>Log shift productivity</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => submit(event, "Productivity logged")}>
            <input type="hidden" name="kind" value="productivity-log" />
            <input type="hidden" name="warehouseId" value={selectedWarehouseId || warehouses[0]?.id} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="shiftDate" label="Date" type="date" defaultValue={todayInput()} required />
              <TextInput name="shiftName" label="Shift" placeholder="Day / Night" defaultValue="Day" required />
            </div>
            <FormField label="Role">
              <Select name="role" defaultValue="Receiver">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Receiver", "Grader", "Packer", "Picker", "Loader", "Billing", "Security"].map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <TextInput name="workerName" label="Worker" placeholder="Name" required />
            <TextInput name="taskType" label="Task" placeholder="GRN / grading / picking / loading" required />
            <div className="grid grid-cols-3 gap-3">
              <TextInput name="qtyHandled" label="Qty" type="number" step="0.001" required />
              <TextInput name="uom" label="UoM" defaultValue="Box" required />
              <TextInput name="hoursWorked" label="Hours" type="number" step="0.1" required />
            </div>
            <Button disabled={submitting || !canManage} className="w-full">Log productivity</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Shift-wise productivity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {summary.map((row) => (
              <div key={row.role} className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.role}</p>
                <p className="font-financial text-2xl font-bold">{numberFormat(row.uph)}</p>
                <p className="text-xs text-muted-foreground">units/hr | {row.workers} workers</p>
              </div>
            ))}
          </div>
          {data.productivityLogs.slice(0, 10).map((row) => (
            <ActionRow
              key={row.id}
              title={`${row.workerName} | ${row.role}`}
              subtitle={`${formatDate(row.shiftDate)} | ${row.taskType} | ${numberFormat(row.qtyHandled)} ${row.uom}`}
              badge={`${numberFormat(row.unitsPerHour)}/hr`}
              tone="success"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ExceptionPanel({ canManage, warehouses, selectedWarehouseId, data, submit, patchAction, submitting }: {
  canManage: boolean;
  warehouses: WarehouseRecord[];
  selectedWarehouseId: string;
  data: WarehouseAdvancedOpsRow;
  submit: (event: FormEvent<HTMLFormElement>, successMessage: string) => void;
  patchAction: (payload: Record<string, unknown>, successMessage: string) => void;
  submitting: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader><CardTitle>Request manager exception</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => submit(event, "Exception sent for approval")}>
            <input type="hidden" name="kind" value="exception-approval" />
            <input type="hidden" name="warehouseId" value={selectedWarehouseId || warehouses[0]?.id} />
            <FormField label="Exception type">
              <Select name="exceptionType" defaultValue="Variance">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Variance", "High wastage", "Temperature breach", "QC rejection", "Late dispatch", "Seal mismatch", "POD dispute"].map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <TextInput name="qty" label="Quantity impact" type="number" step="0.001" />
              <TextInput name="valueAmount" label="Value impact" type="number" step="0.01" />
            </div>
            <TextInput name="refType" label="Reference type" placeholder="stock_item / gate_pass / qc" defaultValue="warehouse" />
            <TextInput name="reason" label="Reason" placeholder="Explain what happened and requested approval" required />
            <Button disabled={submitting || !canManage} className="w-full">Request approval</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Approval queue</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.exceptionApprovals.map((row) => (
            <ActionRow
              key={row.id}
              title={`${row.exceptionType} | ${row.warehouseName}`}
              subtitle={`${row.reason} | Qty ${numberFormat(row.qty)} | Value ${numberFormat(row.valueAmount)}`}
              badge={row.status}
              tone={row.status === "Approved" ? "success" : row.status === "Rejected" ? "danger" : "warning"}
              actions={row.status === "Pending" ? [
                { label: "Approve", onClick: () => patchAction({ kind: "exception-approval", id: row.id, status: "Approved" }, "Exception approved") },
                { label: "Reject", onClick: () => patchAction({ kind: "exception-approval", id: row.id, status: "Rejected" }, "Exception rejected") },
              ] : []}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ClaimsPanel({ canManage, stock, inwardContainers, data, submit, patchAction, submitting }: {
  canManage: boolean;
  stock: StockItemRow[];
  inwardContainers: WarehouseInwardContainerRow[];
  data: WarehouseAdvancedOpsRow;
  submit: (event: FormEvent<HTMLFormElement>, successMessage: string) => void;
  patchAction: (payload: Record<string, unknown>, successMessage: string) => void;
  submitting: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader><CardTitle>Create supplier/container claim</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => submit(event, "Supplier claim created")}>
            <input type="hidden" name="kind" value="supplier-claim" />
            <FormField label="Container">
              <Select name="containerId">
                <SelectTrigger><SelectValue placeholder="Container" /></SelectTrigger>
                <SelectContent>
                  {inwardContainers.map((row) => (
                    <SelectItem key={row.id} value={row.id}>{row.containerNo} | {row.supplier?.name ?? "Supplier pending"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <StockSelect stock={stock} name="stockItemId" optional />
            <FormField label="Claim type">
              <Select name="claimType" defaultValue="Quality claim">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Quality claim", "Short shipment", "Temperature damage", "Packaging damage", "Transit delay", "Weight variance"].map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <TextInput name="claimAmount" label="Amount" type="number" step="0.01" />
              <TextInput name="currency" label="Currency" defaultValue="USD" />
              <TextInput name="wastageQty" label="Wastage qty" type="number" step="0.001" />
            </div>
            <TextInput name="qcPhotoRef" label="QC photo ref" placeholder="Storage path or URL" />
            <TextInput name="notes" label="Claim notes" placeholder="Defect, sample size, supplier evidence" />
            <Button disabled={submitting || !canManage} className="w-full">Create claim</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Supplier claim workflow</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.supplierClaims.map((row) => (
            <ActionRow
              key={row.id}
              title={`${row.claimNo} | ${row.supplierName ?? "Supplier pending"}`}
              subtitle={`${row.claimType} | ${row.containerNo ?? "-"} | ${numberFormat(row.claimAmount)} ${row.currency} | Wastage ${numberFormat(row.wastageQty)}`}
              badge={row.status}
              tone={row.status === "Settled" ? "success" : row.status === "Rejected" ? "danger" : "warning"}
              actions={[
                { label: "Submit", onClick: () => patchAction({ kind: "supplier-claim", id: row.id, status: "Submitted" }, "Claim submitted") },
                { label: "Settle", onClick: () => patchAction({ kind: "supplier-claim", id: row.id, status: "Settled" }, "Claim settled") },
              ]}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StockSelect({ stock, name, optional = false }: { stock: StockItemRow[]; name: string; optional?: boolean }) {
  return (
    <FormField label="Stock lot">
      <Select name={name} required={!optional}>
        <SelectTrigger><SelectValue placeholder={optional ? "Optional stock lot" : "Choose stock lot"} /></SelectTrigger>
        <SelectContent>
          {stock.map((lot) => (
            <SelectItem key={lot.id} value={lot.id}>
              {lot.item} {lot.grade ?? ""} | {lot.lotNo ?? lot.id.slice(0, 8)} | {numberFormat(lot.qtyAvailable)} {lot.uom}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function ActionRow({
  title,
  subtitle,
  badge,
  tone = "default",
  actions = [],
}: {
  title: string;
  subtitle: string;
  badge: string;
  tone?: "default" | "success" | "warning" | "danger";
  actions?: { label: string; onClick: () => void }[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading font-semibold">{title}</p>
          <Badge variant={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "danger" ? "danger" : "outline"}>{badge}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.label} type="button" size="sm" variant="outline" onClick={action.onClick}>{action.label}</Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TextInput(props: ComponentProps<typeof Input> & { label: string }) {
  const { label, className, ...inputProps } = props;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input className={cn("bg-background", className)} {...inputProps} />
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

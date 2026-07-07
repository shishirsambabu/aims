"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/utils";

type Warehouse = { id: string; name: string; code: string; city: string };
type Customer = {
  id: string;
  code: string;
  name: string;
  tradeName: string | null;
  kycStatus: string;
  approvalStatus: string;
  creditHold: boolean;
};
type StockItem = {
  id: string;
  warehouseId: string;
  containerNo: string;
  blNo: string;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: string;
  qtyAvailable: number;
  qtyReserved: number;
  qtySold: number;
  lotNo: string | null;
  palletNo: string | null;
  expiryDate: string | null;
  bestBeforeDate: string | null;
  packDate: string | null;
  createdAt: string;
  fefoDueInDays: number | null;
  expiryBand: "expired" | "critical" | "warning" | "ok" | "none";
};
type PriceList = {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  priceDate: string;
  status: string;
  notes: string | null;
  publishedAt: string | null;
  publishedByName: string | null;
  itemCount: number;
};
type PriceListItemDetail = {
  id: string;
  item: string;
  variety: string | null;
  grade: string | null;
  uom: string;
  basePrice: number;
  floorPrice: number;
  benchmarkPrice: number | null;
  maxDiscountPct: number | null;
};
type OrderRow = {
  id: string;
  orderNo: string;
  customerId: string;
  warehouseId: string;
  customerName: string;
  warehouseName: string;
  priceDate: string | null;
  status: string;
  approvalStatus: string;
  orderDate: string;
  requestedDate: string | null;
  totalQty: number | null;
  grossAmount: number | null;
  discountAmount: number | null;
  netAmount: number | null;
  lineCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  notes: string | null;
};
type OrderDetail = {
  id: string;
  orderNo: string;
  customer: {
    code: string;
    name: string;
    tradeName: string | null;
    creditHold: boolean;
  };
  warehouse: { name: string; code: string; city: string };
  priceList: { id: string; priceDate: string; status: string } | null;
  orderDate: string;
  requestedDate: string | null;
  status: string;
  approvalStatus: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewNotes: string | null;
  notes: string | null;
  lines: {
    id: string;
    lineNo: number;
    stockItemId: string;
    priceListItemId: string | null;
    item: string;
    variety: string | null;
    grade: string | null;
    uom: string;
    qty: number;
    unitPrice: number;
    floorPrice: number;
    discountAmount: number;
    lineTotal: number;
    notes: string | null;
    stockItem: {
      containerNo: string;
      blNo: string;
      warehouseName: string;
      qtyAvailable: number;
      qtyReserved: number;
      qtySold: number;
    };
  }[];
  revisions: {
    id: string;
    revisionNo: number;
    changeType: string;
    note: string | null;
    createdAt: string;
    snapshot: unknown;
  }[];
};

const SALES_CONTROL_POINTS = [
  "Daily price list with warehouse-wise benchmark and floor guardrails",
  "Quote/order creation against approved customers and published day prices",
  "Approval, amendment history, and soft stock reservation before fulfilment",
  "Warehouse handoff into pick, pack, ready, fleet logging, and dispatch",
  "Receivables, customer credit, disputes, and collections linked back to the account",
] as const;
type OrderReviewDialogState = {
  open: boolean;
  orderId: string;
  orderNo: string;
  action: "approve" | "reject" | "cancel";
  reason: string;
};

type PriceLineForm = {
  item: string;
  variety: string;
  grade: string;
  uom: string;
  basePrice: string;
  floorPrice: string;
  benchmarkPrice: string;
  maxDiscountPct: string;
  notes: string;
};

type OrderLineForm = {
  stockItemId: string;
  qty: string;
  unitPrice: string;
  discountAmount: string;
  notes: string;
  matchReason: string;
};

const emptyPriceLine: PriceLineForm = {
  item: "",
  variety: "",
  grade: "",
  uom: "Box",
  basePrice: "",
  floorPrice: "",
  benchmarkPrice: "",
  maxDiscountPct: "",
  notes: "",
};

const emptyOrderLine: OrderLineForm = {
  stockItemId: "",
  qty: "",
  unitPrice: "",
  discountAmount: "",
  notes: "",
  matchReason: "",
};

function stockMatchKey(entry: {
  item: string;
  variety: string | null;
  grade: string | null;
  uom: string;
}) {
  return [
    entry.item.trim().toLowerCase(),
    (entry.variety ?? "").trim().toLowerCase(),
    (entry.grade ?? "").trim().toLowerCase(),
    entry.uom,
  ].join("|");
}

function findMatchingPrice(
  stock: StockItem,
  priceItems: PriceListItemDetail[]
) {
  return priceItems.find((item) => stockMatchKey(item) === stockMatchKey(stock));
}

function getStockMatchReason(
  stock: StockItem | null | undefined,
  priceItems: PriceListItemDetail[]
) {
  if (!stock) return "FEFO fallback";
  return findMatchingPrice(stock, priceItems) ? "Exact item/grade match" : "FEFO fallback";
}

function getMatchedPriceRow(
  stock: StockItem | null | undefined,
  priceItems: PriceListItemDetail[]
) {
  if (!stock) return null;
  return findMatchingPrice(stock, priceItems) ?? null;
}

function getMatchedPriceRowLabel(
  stock: StockItem | null | undefined,
  priceItems: PriceListItemDetail[]
) {
  const priceRow = getMatchedPriceRow(stock, priceItems);
  if (!priceRow) return "No exact price row";
  const rowNumber = priceItems.findIndex((item) => item.id === priceRow.id) + 1;
  return `Row ${rowNumber} - ${formatINR(priceRow.basePrice)}`;
}

function scrollToPriceRow(rowId: string) {
  const el = document.getElementById(rowId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
  }, 1500);
}

export function SalesWorkspace({
  warehouses,
  customers,
  stockItems,
  priceLists,
  orders,
  canWrite,
  canApprove,
  canPublish,
  canViewFloor,
}: {
  warehouses: Warehouse[];
  customers: Customer[];
  stockItems: StockItem[];
  priceLists: PriceList[];
  orders: OrderRow[];
  canWrite: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canViewFloor: boolean;
}) {
  const router = useRouter();
  const approvedCustomers = customers.filter(
    (customer) =>
      customer.approvalStatus === "Approved" && customer.kycStatus === "Approved" && !customer.creditHold
  );

  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orders[0]?.id ?? null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [amendingOrderId, setAmendingOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceListBusy, setPriceListBusy] = useState(false);
  const [priceActionBusyId, setPriceActionBusyId] = useState<string | null>(null);
  const [activePriceListItems, setActivePriceListItems] = useState<PriceListItemDetail[]>([]);
  const [reviewDialog, setReviewDialog] = useState<OrderReviewDialogState>({
    open: false,
    orderId: "",
    orderNo: "",
    action: "approve",
    reason: "",
  });

  const [priceForm, setPriceForm] = useState({
    warehouseId: warehouses[0]?.id ?? "",
    priceDate: new Date().toISOString().slice(0, 10),
    notes: "",
    publish: true,
    items: [{ ...emptyPriceLine }],
  });
  const [orderForm, setOrderForm] = useState({
    customerId: approvedCustomers[0]?.id ?? "",
    warehouseId: warehouses[0]?.id ?? "",
    priceListId: priceLists.find((pl) => pl.status === "Published" && pl.warehouseId === warehouses[0]?.id)?.id ?? "",
    orderDate: new Date().toISOString().slice(0, 10),
    requestedDate: "",
    notes: "",
    amendmentReason: "",
    lines: [{ ...emptyOrderLine }],
  });

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((row) =>
      [row.orderNo, row.customerName, row.warehouseName, row.status, row.approvalStatus]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [orders, query]);

  const warehousePriceLists = priceLists.filter(
    (pl) => pl.warehouseId === orderForm.warehouseId && pl.status === "Published"
  );
  const currentWarehousePrices = priceLists.filter((pl) => pl.warehouseId === orderForm.warehouseId);
  const reviewQueue = useMemo(
    () => orders.filter((order) => order.approvalStatus === "PendingApproval").slice(0, 5),
    [orders]
  );
  const orderRisk = useMemo(() => {
    if (!orderDetail || !canViewFloor) return null;
    let belowFloor = 0;
    let atOrAboveFloor = 0;
    for (const line of orderDetail.lines) {
      if (line.floorPrice == null || line.qty <= 0) continue;
      const effective = line.lineTotal / line.qty;
      if (effective < line.floorPrice) belowFloor += 1;
      else atOrAboveFloor += 1;
    }
    return { belowFloor, atOrAboveFloor };
  }, [canViewFloor, orderDetail]);

  const filteredStock = stockItems.filter((row) => row.warehouseId === orderForm.warehouseId);
  const fefoStock = useMemo(
    () =>
      [...filteredStock].sort((a, b) => {
        const aKey = fefoKey(a);
        const bKey = fefoKey(b);
        if (aKey !== bKey) return aKey - bKey;
        return a.containerNo.localeCompare(b.containerNo);
      }),
    [filteredStock]
  );
  const fefoSuggestions = fefoStock.slice(0, 3);

  useEffect(() => {
    if (!selectedOrderId) return;
    let ignore = false;
    async function load() {
      setDetailBusy(true);
      try {
        const res = await fetch(`/api/sales-orders/${selectedOrderId}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Failed to load order");
          return;
        }
        if (!ignore) setOrderDetail(json.data);
      } catch {
        toast.error("Network error");
      } finally {
        if (!ignore) setDetailBusy(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [selectedOrderId]);

  useEffect(() => {
    let ignore = false;
    async function loadPriceListItems() {
      if (!orderForm.priceListId) {
        setActivePriceListItems([]);
        return;
      }
      setPriceListBusy(true);
      try {
        const res = await fetch(`/api/price-lists/${orderForm.priceListId}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Failed to load day price");
          return;
        }
        if (!ignore) {
          setActivePriceListItems(Array.isArray(json.data?.items) ? (json.data.items as PriceListItemDetail[]) : []);
        }
      } catch {
        toast.error("Network error");
      } finally {
        if (!ignore) setPriceListBusy(false);
      }
    }
    loadPriceListItems();
    return () => {
      ignore = true;
    };
  }, [orderForm.priceListId]);

  const orderSummary = useMemo(() => {
    const lines = orderForm.lines.filter((line) => line.stockItemId && line.qty && line.unitPrice);
    const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
    const grossAmount = lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = lines.reduce((sum, line) => sum + Number(line.discountAmount || 0), 0);
    const netAmount = lines.reduce((sum, line) => sum + Math.max(0, Number(line.qty || 0) * Number(line.unitPrice || 0) - Number(line.discountAmount || 0)), 0);
    return { totalQty, grossAmount, discountAmount, netAmount, validLines: lines.length };
  }, [orderForm.lines]);

  function setPriceLine(index: number, patch: Partial<PriceLineForm>) {
    setPriceForm((form) => {
      const items = [...form.items];
      items[index] = { ...items[index], ...patch };
      return { ...form, items };
    });
  }

  function setOrderLine(index: number, patch: Partial<OrderLineForm>) {
    setOrderForm((form) => {
      const lines = [...form.lines];
      lines[index] = { ...lines[index], ...patch };
      return { ...form, lines };
    });
  }

  async function submitPriceList() {
    if (!canPublish) {
      toast.error("You do not have permission to publish price lists");
      return;
    }
    if (!priceForm.warehouseId) {
      toast.error("Choose a warehouse");
      return;
    }
    const payload = {
      warehouseId: priceForm.warehouseId,
      priceDate: priceForm.priceDate,
      notes: priceForm.notes,
      publish: priceForm.publish,
      items: priceForm.items.map((item) => ({
        item: item.item,
        variety: item.variety || undefined,
        grade: item.grade || undefined,
        uom: item.uom,
        basePrice: item.basePrice,
        floorPrice: item.floorPrice,
        benchmarkPrice: item.benchmarkPrice || undefined,
        maxDiscountPct: item.maxDiscountPct || undefined,
        notes: item.notes || undefined,
      })),
    };
    setSaving(true);
    try {
      const res = await fetch("/api/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save price list");
        return;
      }
      toast.success(priceForm.publish ? "Price list published" : "Price list created");
      setPriceDialogOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function submitOrder() {
    if (!canWrite) {
      toast.error("You do not have permission to create orders");
      return;
    }
    if (!orderForm.customerId || !orderForm.warehouseId) {
      toast.error("Choose a customer and warehouse");
      return;
    }
    if (!orderForm.priceListId) {
      toast.error("Choose the day price for this warehouse");
      return;
    }
    const invalidLine = orderForm.lines.find(
      (line) => line.stockItemId && (!line.qty || !line.unitPrice)
    );
    if (invalidLine) {
      toast.error("Every selected stock lot needs qty and unit price");
      return;
    }
    const payload = {
      customerId: orderForm.customerId,
      warehouseId: orderForm.warehouseId,
      priceListId: orderForm.priceListId || undefined,
      orderDate: orderForm.orderDate,
      requestedDate: orderForm.requestedDate || undefined,
      notes: orderForm.notes,
      lines: orderForm.lines
        .filter((line) => line.stockItemId && line.qty)
        .map((line) => ({
          stockItemId: line.stockItemId,
          qty: line.qty,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount || undefined,
          notes: line.notes || undefined,
        })),
    };
    const amendmentReason = amendingOrderId ? orderForm.amendmentReason.trim() : null;
    if (amendingOrderId && !amendmentReason) {
      toast.error("An amendment reason is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        amendingOrderId ? `/api/sales-orders/${amendingOrderId}` : "/api/sales-orders",
        {
        method: amendingOrderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          amendingOrderId
            ? {
                action: "amend",
                reason: amendmentReason,
                requestedDate: payload.requestedDate,
                notes: payload.notes,
                lines: payload.lines,
              }
            : payload
        ),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create sales order");
        return;
      }
      toast.success(amendingOrderId ? "Sales order amended and re-reserved" : "Sales order submitted");
      setOrderDialogOpen(false);
      setAmendingOrderId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function openOrderAmendment() {
    if (!orderDetail || orderDetail.status !== "PendingApproval") return;
    setAmendingOrderId(orderDetail.id);
    setOrderForm({
      customerId: orders.find((order) => order.id === orderDetail.id)?.customerId ?? "",
      warehouseId: orders.find((order) => order.id === orderDetail.id)?.warehouseId ?? "",
      priceListId: orderDetail.priceList?.id ?? "",
      orderDate: orderDetail.orderDate,
      requestedDate: orderDetail.requestedDate ?? "",
      notes: orderDetail.notes ?? "",
      amendmentReason: "",
      lines: orderDetail.lines.map((line) => ({
        stockItemId: line.stockItemId,
        qty: String(line.qty),
        unitPrice: String(line.unitPrice),
        discountAmount: line.discountAmount ? String(line.discountAmount) : "",
        notes: line.notes ?? "",
        matchReason: "Saved order allocation",
      })),
    });
    setOrderDialogOpen(true);
  }

  function openReviewDialog(order: Pick<OrderRow, "id" | "orderNo">, action: "approve" | "reject" | "cancel") {
    setReviewDialog({
      open: true,
      orderId: order.id,
      orderNo: order.orderNo,
      action,
      reason: "",
    });
  }

  async function submitOrderReview() {
    const reason = reviewDialog.reason.trim();
    if (reason.length < 3) {
      toast.error("A review reason is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sales-orders/${reviewDialog.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: reviewDialog.action, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to review order");
        return;
      }
      toast.success(reviewDialog.action === "approve" ? "Order approved" : reviewDialog.action === "reject" ? "Order rejected" : "Order cancelled");
      setReviewDialog((current) => ({ ...current, open: false }));
      router.refresh();
      if (selectedOrderId === reviewDialog.orderId) {
        const res = await fetch(`/api/sales-orders/${reviewDialog.orderId}`);
        const json = await res.json();
        if (res.ok) setOrderDetail(json.data);
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendToFulfilment(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/sales-orders/${id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create gate pass");
        return;
      }
      toast.success("Gate pass created from sales order");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updatePriceList(id: string, action: "publish" | "unpublish" | "archive") {
    if (!canPublish) return;
    setPriceActionBusyId(id);
    try {
      const res = await fetch(`/api/price-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update price list");
        return;
      }
      toast.success(
        action === "publish"
          ? "Price list published"
          : action === "unpublish"
            ? "Price list reverted to draft"
            : "Price list archived"
      );
      router.refresh();
    } finally {
      setPriceActionBusyId(null);
    }
  }

  const updateLineDefaults = useCallback(
    (index: number, stockItemId: string) => {
      const stock = filteredStock.find((row) => row.id === stockItemId);
      let unitPrice = "";
      const matchingPrice = stock ? findMatchingPrice(stock, activePriceListItems) : null;
      if (matchingPrice) unitPrice = String(matchingPrice.basePrice);
      setOrderLine(index, {
        stockItemId,
        unitPrice,
        matchReason: getStockMatchReason(stock, activePriceListItems),
      });
    },
    [activePriceListItems, filteredStock]
  );

  function insertFefoSuggestion(index: number, stockItemId: string) {
    void updateLineDefaults(index, stockItemId);
  }

  function fefoKey(stock: StockItem) {
    const date =
      stock.expiryDate ??
      stock.bestBeforeDate ??
      stock.packDate ??
      stock.createdAt;
    return new Date(date).getTime();
  }

  function bestStockIdForWarehouse(
    warehouseId: string,
    excludeIds: string[] = []
  ) {
    return (
      [...stockItems]
      .filter((row) => row.warehouseId === warehouseId && !excludeIds.includes(row.id))
      .sort((a, b) => {
          const aMatch = !!findMatchingPrice(a, activePriceListItems);
          const bMatch = !!findMatchingPrice(b, activePriceListItems);
          if (aMatch !== bMatch) return aMatch ? -1 : 1;
          const aKey = fefoKey(a);
          const bKey = fefoKey(b);
          if (aKey !== bKey) return aKey - bKey;
          return a.containerNo.localeCompare(b.containerNo);
        })[0]?.id ?? null
    );
  }

  function buildPrefilledLine(stockItemId?: string) {
    if (!stockItemId) return { ...emptyOrderLine };
    const stock = stockItems.find((row) => row.id === stockItemId);
    const matchingPrice = stock ? findMatchingPrice(stock, activePriceListItems) : null;
    return {
      stockItemId,
      qty: "",
      unitPrice: matchingPrice ? String(matchingPrice.basePrice) : "",
      discountAmount: "",
      notes: "",
      matchReason: getStockMatchReason(stock, activePriceListItems),
    };
  }

  function openOrderDialog() {
    const firstStockId = bestStockIdForWarehouse(orderForm.warehouseId);
    setAmendingOrderId(null);
    setOrderForm((form) => ({
      ...form,
      amendmentReason: "",
      lines: [buildPrefilledLine(firstStockId)],
    }));
    setOrderDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Orders" value={orders.length.toString()} />
        <Metric label="Pending" value={orders.filter((o) => o.approvalStatus === "PendingApproval").length.toString()} />
        <Metric label="Published Prices" value={priceLists.filter((p) => p.status === "Published").length.toString()} />
        <Metric label="Stock Lots" value={stockItems.length.toString()} />
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="label-caps">Sales operating flow</p>
            <h3 className="mt-1 font-heading text-xl font-semibold">
              Price, reserve, approve, fulfil, and collect
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The sales module shares live customer, credit, price, stock, warehouse
              fulfilment, and finance data. Final dispatch now requires fleet details
              before the gate pass can be closed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/customers">Customer credit</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/warehouse?view=dispatch">Warehouse dispatch</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/receipts">Receivables</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/sop">Sales SOP</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            {SALES_CONTROL_POINTS.map((point, index) => (
              <div
                key={point}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface-alt/40 p-3 text-sm"
              >
                <span className="font-financial flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-muted-foreground">{point}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="label-caps">Day Price Desk</p>
                <h3 className="font-heading text-base font-semibold">Warehouse price control</h3>
              </div>
              {canPublish && (
                <Button variant="outline" onClick={() => setPriceDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> New Day Price
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              {currentWarehousePrices.length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="No price lists for this warehouse"
                  description="Create the first day price so sales can start matching stock to a published rate."
                  className="border-0 bg-transparent py-6"
                />
              ) : (
                currentWarehousePrices.map((priceList) => (
                  <div key={priceList.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              priceList.status === "Published"
                                ? "success"
                                : priceList.status === "Archived"
                                  ? "danger"
                                  : "outline"
                            }
                          >
                            {priceList.status}
                          </Badge>
                          <span className="font-medium">
                            {priceList.priceDate}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {priceList.itemCount} rows - {priceList.publishedByName ?? "Not published yet"}
                        </p>
                        {canViewFloor && priceList.notes ? (
                          <p className="text-xs text-muted-foreground">{priceList.notes}</p>
                        ) : null}
                      </div>
                      {canPublish && (
                        <div className="flex flex-wrap gap-2">
                          {priceList.status !== "Published" && (
                            <Button
                              size="sm"
                              onClick={() => updatePriceList(priceList.id, "publish")}
                              disabled={priceActionBusyId === priceList.id}
                            >
                              {priceActionBusyId === priceList.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Publish
                            </Button>
                          )}
                          {priceList.status === "Published" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updatePriceList(priceList.id, "unpublish")}
                              disabled={priceActionBusyId === priceList.id}
                            >
                              Revert
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updatePriceList(priceList.id, "archive")}
                            disabled={priceActionBusyId === priceList.id}
                          >
                            Archive
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="label-caps">Approval Queue</p>
                <Badge variant="outline">{reviewQueue.length} pending</Badge>
              </div>
              <div className="space-y-2">
                {reviewQueue.length === 0 ? (
                  <EmptyState
                    icon={ShieldAlert}
                    title="No orders awaiting review"
                    description="Approved and rejected orders are tracked in the main list."
                    className="border-0 bg-transparent py-4"
                  />
                ) : (
                  reviewQueue.map((order) => (
                    <div key={order.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{order.orderNo}</span>
                            <Badge variant="warning">{order.approvalStatus}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.customerName} - {order.warehouseName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.lineCount} lines - {formatINR(order.netAmount)}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedOrderId(order.id)}>
                            Open
                          </Button>
                          {canApprove && (
                            <>
                              <Button size="sm" onClick={() => openReviewDialog(order, "approve")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openReviewDialog(order, "reject")}>
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <p className="label-caps pt-2">Order Health</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Meta
                  label="Published price rows"
                  value={priceLists.filter((p) => p.status === "Published").reduce((sum, p) => sum + p.itemCount, 0)}
                />
                <Meta
                  label="Orders awaiting approval"
                  value={orders.filter((o) => o.approvalStatus === "PendingApproval").length}
                />
                <Meta
                  label="Stock lots ready"
                  value={stockItems.filter((row) => row.qtyAvailable > 0).length}
                />
                <Meta
                  label="Customers eligible"
                  value={approvedCustomers.length}
                />
              </div>
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-[#9A6212]">
                Keep the day price published before order creation. That keeps the floor rule and dispatch queue consistent.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order no, customer, warehouse, status..."
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button onClick={openOrderDialog}>
              <Plus className="h-4 w-4" /> New Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold">Sales Orders</h3>
              <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Lines</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-44 text-center text-muted-foreground">
                        <EmptyState
                          icon={ShieldAlert}
                          title="No sales orders yet"
                          description="Publish a day price and create the first order to reserve stock."
                          className="border-0 bg-transparent py-6"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((row) => (
                      <TableRow
                        key={row.id}
                        className={row.id === selectedOrderId ? "bg-primary/5" : ""}
                        onClick={() => setSelectedOrderId(row.id)}
                      >
                        <TableCell className="font-medium">{row.orderNo}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.customerName}</p>
                            <p className="text-xs text-muted-foreground">{row.orderDate}</p>
                          </div>
                        </TableCell>
                        <TableCell>{row.warehouseName}</TableCell>
                        <TableCell>
                          <Badge variant={row.approvalStatus === "Approved" ? "success" : row.approvalStatus === "Rejected" ? "danger" : "warning"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-financial text-right">{formatINR(row.netAmount)}</TableCell>
                        <TableCell className="font-financial text-right">{row.lineCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canApprove && row.approvalStatus === "PendingApproval" && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReviewDialog(row, "approve");
                                  }}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-success"
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReviewDialog(row, "reject");
                                  }}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-danger"
                                  title="Reject"
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReviewDialog(row, "cancel");
                                  }}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-surface-alt hover:text-warning"
                                  title="Cancel"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {detailBusy ? (
              <div className="flex min-h-[500px] items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : orderDetail ? (
              <div className="space-y-4">
                <div>
                  <p className="label-caps">Order Detail</p>
                  <h3 className="font-heading text-xl font-semibold">{orderDetail.orderNo}</h3>
                  <p className="text-sm text-muted-foreground">
                    {orderDetail.customer.name} {orderDetail.customer.tradeName ? `- ${orderDetail.customer.tradeName}` : ""}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Meta label="Warehouse" value={`${orderDetail.warehouse.name} (${orderDetail.warehouse.code})`} />
                  <Meta label="Order Date" value={orderDetail.orderDate} />
                  <Meta label="Status" value={orderDetail.status} />
                  <Meta label="Net" value={formatINR(orders.find((row) => row.id === orderDetail.id)?.netAmount ?? null)} />
                </div>

                {orderDetail.customer.creditHold ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                    This customer is on credit hold. Existing orders stay visible, but new ordering should remain blocked.
                  </div>
                ) : null}

                {orderRisk ? (
                  <div className="grid gap-3 rounded-xl border border-border bg-surface-alt/30 p-3 sm:grid-cols-2">
                    <Meta label="Lines at / above floor" value={orderRisk.atOrAboveFloor} />
                    <Meta label="Lines below floor" value={orderRisk.belowFloor} />
                  </div>
                ) : null}

                <div className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">Revision history</p>
                    <Badge variant="outline">{orderDetail.revisions.length} revisions</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {orderDetail.revisions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No revisions yet.</p>
                    ) : orderDetail.revisions.map((revision) => (
                      <div key={revision.id} className="rounded-lg bg-surface-alt/40 p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Revision {revision.revisionNo}</span>
                          <Badge variant="outline">{revision.changeType}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {revision.note ?? "No note"} - {revision.createdAt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {orderDetail.approvalStatus === "Approved" && orderDetail.status !== "Fulfilled" && (
                  <div className="flex justify-end">
                    <Button onClick={() => sendToFulfilment(orderDetail.id)} disabled={saving}>
                      Create Gate Pass
                    </Button>
                  </div>
                )}

                {canWrite && orderDetail.status === "PendingApproval" ? (
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={openOrderAmendment} disabled={saving}>
                      Amend order
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {orderDetail.lines.map((line) => (
                    <div key={line.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {line.item} {line.grade ? `- ${line.grade}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {line.stockItem.containerNo} - {line.stockItem.blNo} - Avail {line.stockItem.qtyAvailable}
                          </p>
                          {canViewFloor && line.floorPrice != null ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant={line.unitPrice < line.floorPrice ? "danger" : "success"}>
                                {line.unitPrice < line.floorPrice ? "Below floor" : "At / above floor"}
                              </Badge>
                              <Badge variant="outline">
                                Effective {formatINR(line.lineTotal / Math.max(line.qty, 1))}
                              </Badge>
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-financial">{formatINR(line.lineTotal)}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.qty} x {formatINR(line.unitPrice)}
                            {canViewFloor && line.floorPrice != null ? ` - floor ${formatINR(line.floorPrice)}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={ShieldAlert}
                title="Select an order"
                description="Open an order row to inspect its reserved stock, price, and approval trail."
                className="border-0 bg-transparent py-10"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve"
                ? "Approve sales order"
                : reviewDialog.action === "reject"
                  ? "Reject sales order"
                  : "Cancel sales order"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.orderNo
                ? `${reviewDialog.orderNo} will move through the sales control workflow with this reason.`
                : "Record the sales order review decision."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Review reason</Label>
            <Input
              value={reviewDialog.reason}
              onChange={(event) =>
                setReviewDialog((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder="Credit checked, price reviewed, stock reservation valid..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialog((current) => ({ ...current, open: false }))}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant={reviewDialog.action === "approve" ? "default" : "destructive"}
              onClick={submitOrderReview}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {reviewDialog.action === "approve"
                ? "Approve"
                : reviewDialog.action === "reject"
                  ? "Reject"
                  : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish Day Price</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Warehouse">
              <Select value={priceForm.warehouseId} onValueChange={(value) => setPriceForm({ ...priceForm, warehouseId: value })}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Price Date">
              <Input type="date" value={priceForm.priceDate} onChange={(e) => setPriceForm({ ...priceForm, priceDate: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Input value={priceForm.notes} onChange={(e) => setPriceForm({ ...priceForm, notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={priceForm.publish}
                onChange={(e) => setPriceForm({ ...priceForm, publish: e.target.checked })}
              />
              Publish immediately
            </label>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading text-base font-semibold">Price Rows</h4>
              <Button variant="outline" size="sm" onClick={() => setPriceForm({ ...priceForm, items: [...priceForm.items, { ...emptyPriceLine }] })}>
                <Plus className="h-4 w-4" /> Add Row
              </Button>
            </div>
            <div className="space-y-3">
              {priceForm.items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-3">
                  <Input placeholder="Item" value={item.item} onChange={(e) => setPriceLine(index, { item: e.target.value })} />
                  <Input placeholder="Variety" value={item.variety} onChange={(e) => setPriceLine(index, { variety: e.target.value })} />
                  <Input placeholder="Grade" value={item.grade} onChange={(e) => setPriceLine(index, { grade: e.target.value })} />
                  <Select value={item.uom} onValueChange={(value) => setPriceLine(index, { uom: value })}>
                    <SelectTrigger><SelectValue placeholder="UoM" /></SelectTrigger>
                    <SelectContent>
                      {["Box", "Kg", "Pallet", "Punnet", "Container", "Carton", "CasePack"].map((uom) => (
                        <SelectItem key={uom} value={uom}>{uom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Base price" value={item.basePrice} onChange={(e) => setPriceLine(index, { basePrice: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Floor price" value={item.floorPrice} onChange={(e) => setPriceLine(index, { floorPrice: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Market benchmark" value={item.benchmarkPrice} onChange={(e) => setPriceLine(index, { benchmarkPrice: e.target.value })} />
                  <Input type="number" step="0.01" placeholder="Max discount %" value={item.maxDiscountPct} onChange={(e) => setPriceLine(index, { maxDiscountPct: e.target.value })} />
                  <Input placeholder="Notes" value={item.notes} onChange={(e) => setPriceLine(index, { notes: e.target.value })} />
                  <div className="flex items-center justify-end md:col-span-3">
                    <Button variant="ghost" size="sm" onClick={() => setPriceForm({ ...priceForm, items: priceForm.items.length === 1 ? [{ ...emptyPriceLine }] : priceForm.items.filter((_, i) => i !== index) })}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPriceDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submitPriceList} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={orderDialogOpen}
        onOpenChange={(open) => {
          setOrderDialogOpen(open);
          if (!open) setAmendingOrderId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{amendingOrderId ? "Amend Sales Order" : "Create Sales Order"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              <Select value={orderForm.customerId} onValueChange={(value) => setOrderForm({ ...orderForm, customerId: value })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {approvedCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.code} - {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Warehouse">
              <Select
                value={orderForm.warehouseId}
                onValueChange={(value) => {
                  const nextPriceList = priceLists.find(
                    (pl) => pl.warehouseId === value && pl.status === "Published"
                  );
                  const nextFirstStockId = bestStockIdForWarehouse(value);
                  setOrderForm({
                    ...orderForm,
                    warehouseId: value,
                    priceListId: nextPriceList?.id ?? "",
                    lines: [buildPrefilledLine(nextFirstStockId)],
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Day Price">
              <Select value={orderForm.priceListId} onValueChange={(value) => setOrderForm({ ...orderForm, priceListId: value })}>
                <SelectTrigger><SelectValue placeholder="Select day price" /></SelectTrigger>
                <SelectContent>
                  {warehousePriceLists.map((priceList) => (
                    <SelectItem key={priceList.id} value={priceList.id}>{priceList.priceDate} - {priceList.itemCount} rows</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Order Date">
              <Input type="date" value={orderForm.orderDate} onChange={(e) => setOrderForm({ ...orderForm, orderDate: e.target.value })} />
            </Field>
            <Field label="Requested Date">
              <Input type="date" value={orderForm.requestedDate} onChange={(e) => setOrderForm({ ...orderForm, requestedDate: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Input value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} />
            </Field>
            {amendingOrderId ? (
              <Field label="Amendment Reason">
                <Input
                  value={orderForm.amendmentReason}
                  onChange={(e) => setOrderForm({ ...orderForm, amendmentReason: e.target.value })}
                  placeholder="Required: why this order is being changed"
                />
              </Field>
            ) : null}
          </div>

          {activePriceListItems.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-surface-alt/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-caps">Day Price Rows</p>
                  <p className="text-xs text-muted-foreground">
                    Click a row number from the picker to jump back here.
                  </p>
                </div>
                <Badge variant="outline">{activePriceListItems.length} rows</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {activePriceListItems.map((item, index) => (
                  <div
                    key={item.id}
                    id={`price-row-${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Row {index + 1} - {item.item}
                        {item.variety ? ` - ${item.variety}` : ""}
                        {item.grade ? ` - ${item.grade}` : ""}
                        - {item.uom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Base {formatINR(item.basePrice)}
                        {item.floorPrice != null ? ` - Floor ${formatINR(item.floorPrice)}` : ""}
                        {item.maxDiscountPct != null ? ` - Max discount ${item.maxDiscountPct.toFixed(1)}%` : ""}
                      </p>
                    </div>
                    <Badge variant="outline">Exact match target</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading text-base font-semibold">Order Lines</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const chosenStockId = bestStockIdForWarehouse(
                    orderForm.warehouseId,
                    orderForm.lines.map((line) => line.stockItemId).filter(Boolean) as string[]
                  );
                  setOrderForm({
                    ...orderForm,
                    lines: [...orderForm.lines, buildPrefilledLine(chosenStockId)],
                  });
                }}
              >
                <Plus className="h-4 w-4" /> Add Line
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-surface-alt/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-caps">FEFO Suggestions</p>
                  <p className="text-xs text-muted-foreground">
                    Oldest stock in this warehouse is surfaced first for the selected day price.
                  </p>
                </div>
                <Badge variant="outline">{fefoSuggestions.length} shown</Badge>
              </div>
              <div className="mt-3 grid gap-2">
                {fefoSuggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stock lots available for this warehouse.</p>
                ) : (
                  fefoSuggestions.map((stock) => (
                    <button
                      key={stock.id}
                      type="button"
                      onClick={() => insertFefoSuggestion(0, stock.id)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-surface-alt"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {stock.containerNo} - {stock.item}
                          {stock.grade ? ` - ${stock.grade}` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {stock.blNo} - Avail {stock.qtyAvailable}
                          {stock.fefoDueInDays == null
                            ? ""
                            : stock.fefoDueInDays < 0
                              ? ` - ${Math.abs(stock.fefoDueInDays)}d overdue`
                              : ` - ${stock.fefoDueInDays}d left`}
                        </p>
                      </div>
                      <Badge
                        variant={
                          getStockMatchReason(stock, activePriceListItems) === "Exact item/grade match"
                            ? "success"
                            : stock.expiryBand === "expired"
                              ? "danger"
                              : stock.expiryBand === "critical"
                                ? "warning"
                                : "outline"
                        }
                      >
                        {getStockMatchReason(stock, activePriceListItems)} - {getMatchedPriceRowLabel(stock, activePriceListItems)}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
            {orderForm.lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-4">
                <Select
                  value={line.stockItemId}
                  onValueChange={(value) => {
                    void updateLineDefaults(index, value);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Stock lot" /></SelectTrigger>
                  <SelectContent>
                    {fefoStock.map((stock) => (
                      <SelectItem key={stock.id} value={stock.id}>
                        {stock.containerNo} - {stock.item} {stock.grade ? `- ${stock.grade}` : ""} - Avail {stock.qtyAvailable}
                        {stock.fefoDueInDays == null
                          ? ""
                          : stock.fefoDueInDays < 0
                            ? ` - ${Math.abs(stock.fefoDueInDays)}d overdue`
                            : ` - ${stock.fefoDueInDays}d left`}
                        <span className="text-xs text-muted-foreground">
                          {getStockMatchReason(stock, activePriceListItems)} - {getMatchedPriceRowLabel(stock, activePriceListItems)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="md:col-span-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-alt/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {line.stockItemId
                      ? "Match reason"
                      : "Choose a stock lot to see why it was picked."}
                  </p>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        line.matchReason === "Exact item/grade match"
                          ? "success"
                          : line.matchReason
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {line.matchReason || "FEFO fallback"}
                    </Badge>
                    {line.stockItemId ? (
                      <button
                        type="button"
                        onClick={() => {
                          const stock = stockItems.find((entry) => entry.id === line.stockItemId);
                          const priceRow = getMatchedPriceRow(stock, activePriceListItems);
                          if (priceRow) scrollToPriceRow(`price-row-${priceRow.id}`);
                        }}
                        className="max-w-[260px] rounded-full border border-border bg-background px-2.5 py-1 text-right text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                      >
                        {getMatchedPriceRowLabel(
                          stockItems.find((stock) => stock.id === line.stockItemId),
                          activePriceListItems
                        )}
                      </button>
                    ) : (
                      <Badge variant="outline">No exact price row</Badge>
                    )}
                  </div>
                </div>
                <Input type="number" step="0.001" placeholder="Qty" value={line.qty} onChange={(e) => setOrderLine(index, { qty: e.target.value })} />
                <Input type="number" step="0.01" placeholder="Unit price" value={line.unitPrice} onChange={(e) => setOrderLine(index, { unitPrice: e.target.value })} />
                <Input type="number" step="0.01" placeholder="Discount" value={line.discountAmount} onChange={(e) => setOrderLine(index, { discountAmount: e.target.value })} />
                <Input placeholder="Notes" value={line.notes} onChange={(e) => setOrderLine(index, { notes: e.target.value })} className="md:col-span-3" />
                <div className="flex items-center justify-end md:col-span-4">
                  <Button variant="ghost" size="sm" onClick={() => setOrderForm({ ...orderForm, lines: orderForm.lines.length === 1 ? [{ ...emptyOrderLine }] : orderForm.lines.filter((_, i) => i !== index) })}>
                    Remove line
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface-alt/30 p-3 sm:grid-cols-4">
            <Meta label="Valid Lines" value={orderSummary.validLines} />
            <Meta label="Qty" value={orderSummary.totalQty} />
            <Meta label="Gross" value={formatINR(orderSummary.grossAmount)} />
            <Meta label="Net" value={formatINR(orderSummary.netAmount)} />
          </div>

          {priceListBusy ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading price rows...</p>
          ) : activePriceListItems.length === 0 ? (
            <p className="mt-2 text-xs text-warning">
              No matching price rows loaded yet. Pick a day price before adding stock lines.
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submitOrder} disabled={saving || priceListBusy}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-t-4 border-t-primary">
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-financial mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value ?? "-"}</p>
    </div>
  );
}

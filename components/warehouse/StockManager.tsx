"use client";

import { useEffect, useMemo, useState, type ComponentType, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  PackageOpen,
  RotateCcw,
  RotateCw,
  Scissors,
  ShieldAlert,
  Truck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, STORAGE_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import type { StockItemRow, StockMovementRow } from "@/lib/data/stock";
import type { GatePassRow } from "@/lib/data/dispatch";

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
  city: string;
}

interface WarehouseLocationOption {
  id: string;
  warehouseId: string;
  parentId: string | null;
  code: string;
  name: string;
  type: "Room" | "Zone" | "Bin" | "Dock" | "Staging";
  sortOrder: number;
  capacityUnits: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  isActive: boolean;
  notes: string | null;
}

interface WarehouseCycleCountOption {
  id: string;
  countNo: string;
  warehouseId: string;
  status: "Draft" | "InProgress" | "Completed";
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  lineCount: number;
}

interface ReceiveContainer {
  id: string;
  containerNo: string;
  blNo: string;
  item: string | null;
  variety: string | null;
  noOfBoxes: number | null;
  warehouse: { name: string; code: string } | null;
}

interface WarehouseInwardContainer {
  id: string;
  containerNo: string;
  blNo: string;
  item: string | null;
  variety: string | null;
  noOfBoxes: number | null;
  status: string;
  eta: string | null;
  ata: string | null;
  warehouseAssignedAt: string | null;
  warehouseInDate: string | null;
  warehouse: { id: string; name: string; code: string; city: string } | null;
  supplier: { name: string } | null;
}

interface ReceiveRowState {
  item: string;
  variety: string;
  grade: string;
  uom: "Box" | "Kg" | "Pallet" | "Punnet" | "Container" | "Carton" | "CasePack";
  qtyReceived: string;
  perUnitWeightKg: string;
  lotNo: string;
  palletNo: string;
  packDate: string;
  expiryDate: string;
  bestBeforeDate: string;
  storageCondition: string;
  ripeningState: string;
  qualityStatus: "Released" | "QualityHold" | "Quarantine" | "Rejected";
  temperatureAtReceiptC: string;
  temperatureBreach: boolean;
  qualityHoldReason: string;
  locationId: string;
}

const UOM_OPTIONS: ReceiveRowState["uom"][] = [
  "Box",
  "Kg",
  "Pallet",
  "Punnet",
  "Container",
  "Carton",
  "CasePack",
];

const BOARD_STATUSES = [
  "Picked",
  "Packed",
  "Ready",
  "PartiallyDispatched",
  "Dispatched",
  "Cancelled",
] as const;

const BOARD_STATUS_LABELS: Record<(typeof BOARD_STATUSES)[number], string> = {
  Picked: "Picked",
  Packed: "Packed",
  Ready: "Ready",
  PartiallyDispatched: "Partially Dispatched",
  Dispatched: "Dispatched",
  Cancelled: "Cancelled",
};

const BOARD_STORAGE_KEY = "aims.warehouse.fulfilment-board.v1";
type BoardFilterMode = "all" | "active" | "closed";
type BoardPreset = {
  id: string;
  name: string;
  boardSearch: string;
  boardFilter: BoardFilterMode;
  visibleBoardStatuses: (typeof BOARD_STATUSES)[number][];
};
type BoardStorageState = {
  boardSearch: string;
  boardFilter: BoardFilterMode;
  visibleBoardStatuses: (typeof BOARD_STATUSES)[number][];
  activePresetId: string | null;
  presets: BoardPreset[];
};
type StockActionKind = "reserve" | "release" | "wastage" | "dump" | "adjust";
type StockActionDialogState = {
  open: boolean;
  stockItemId: string;
  action: StockActionKind;
  qty: string;
  direction: "increase" | "decrease";
  reason: string;
  evidenceRef: string;
};
type QualityDialogState = {
  open: boolean;
  stockItemId: string;
  qualityStatus: "Released" | "QualityHold" | "Quarantine" | "Rejected";
  reason: string;
};
type TransferDialogState = {
  open: boolean;
  stockItemId: string;
  locationId: string;
  reason: string;
};
type PresetDialogState = {
  open: boolean;
  mode: "save" | "rename";
  name: string;
};
type FleetDialogState = {
  open: boolean;
  gatePassId: string;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
  vehicleSealNo: string;
  loadingPhotoRef: string;
  routeName: string;
  beatName: string;
  deliveryInstructions: string;
  returnCratesPlanned: string;
  returnPalletsPlanned: string;
  loadingPhotoFile: File | null;
  notes: string;
};
type GateDialogState = {
  open: boolean;
  gatePassId: string;
  securityOtp: string;
};
type PodDialogState = {
  open: boolean;
  gatePassId: string;
  podRef: string;
  podAcknowledgedBy: string;
  returnCratesReceived: string;
  returnPalletsReceived: string;
  podFile: File | null;
};
const STOCK_ACTION_LABELS: Record<StockActionKind, string> = {
  reserve: "Reserve stock",
  release: "Release reserve",
  wastage: "Record wastage",
  dump: "Record dump",
  adjust: "Manual adjustment",
};

const ACTIVE_BOARD_STATUSES = new Set<(typeof BOARD_STATUSES)[number]>([
  "Picked",
  "Packed",
  "Ready",
  "PartiallyDispatched",
]);
const CLOSED_BOARD_STATUSES = new Set<(typeof BOARD_STATUSES)[number]>([
  "Dispatched",
  "Cancelled",
]);

function normalizeVisibleStatuses(
  statuses: unknown
): (typeof BOARD_STATUSES)[number][] {
  if (!Array.isArray(statuses) || statuses.length === 0) return [...BOARD_STATUSES];
  const allowed = statuses.filter(
    (status): status is (typeof BOARD_STATUSES)[number] => BOARD_STATUSES.includes(status)
  );
  return allowed.length > 0 ? allowed : [...BOARD_STATUSES];
}

function readBoardPreferences(): BoardStorageState {
  if (typeof window === "undefined") {
    return {
      boardSearch: "",
      boardFilter: "all" as BoardFilterMode,
      visibleBoardStatuses: [...BOARD_STATUSES],
      activePresetId: null,
      presets: [],
    };
  }
  try {
    const raw = window.localStorage.getItem(BOARD_STORAGE_KEY);
    if (!raw) {
      return {
        boardSearch: "",
        boardFilter: "all" as BoardFilterMode,
        visibleBoardStatuses: [...BOARD_STATUSES],
        activePresetId: null,
        presets: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<BoardStorageState>;
    const presets = Array.isArray(parsed.presets)
      ? parsed.presets
          .map((preset) => ({
            id: typeof preset?.id === "string" ? preset.id : "",
            name: typeof preset?.name === "string" ? preset.name : "",
            boardSearch: typeof preset?.boardSearch === "string" ? preset.boardSearch : "",
            boardFilter:
              preset?.boardFilter === "active" || preset?.boardFilter === "closed"
                ? (preset.boardFilter as BoardFilterMode)
                : "all",
            visibleBoardStatuses: normalizeVisibleStatuses(preset?.visibleBoardStatuses),
          }))
          .filter((preset) => preset.id && preset.name.trim())
      : [];
    return {
      boardSearch: typeof parsed.boardSearch === "string" ? parsed.boardSearch : "",
      boardFilter:
        parsed.boardFilter === "active" || parsed.boardFilter === "closed" ? parsed.boardFilter : "all",
      visibleBoardStatuses: normalizeVisibleStatuses(parsed.visibleBoardStatuses),
      activePresetId:
        typeof parsed.activePresetId === "string" && presets.some((preset) => preset.id === parsed.activePresetId)
          ? parsed.activePresetId
          : null,
      presets,
    };
  } catch {
    return {
      boardSearch: "",
      boardFilter: "all" as BoardFilterMode,
      visibleBoardStatuses: [...BOARD_STATUSES],
      activePresetId: null,
      presets: [],
    };
  }
}

function storageStateFromValues(state: BoardStorageState): BoardStorageState {
  return {
    boardSearch: state.boardSearch,
    boardFilter: state.boardFilter,
    visibleBoardStatuses: state.visibleBoardStatuses,
    activePresetId: state.activePresetId,
    presets: state.presets,
  };
}

function presetIdFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function nextPresetId(name: string, presets: BoardPreset[]) {
  const base = presetIdFromName(name) || `preset-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (presets.some((preset) => preset.id === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function blankRow(prefill?: Partial<ReceiveRowState>): ReceiveRowState {
  return {
    item: prefill?.item ?? "",
    variety: prefill?.variety ?? "",
    grade: prefill?.grade ?? "",
    uom: prefill?.uom ?? "Box",
    qtyReceived: prefill?.qtyReceived ?? "",
    perUnitWeightKg: prefill?.perUnitWeightKg ?? "",
    lotNo: prefill?.lotNo ?? "",
    palletNo: prefill?.palletNo ?? "",
    packDate: prefill?.packDate ?? "",
    expiryDate: prefill?.expiryDate ?? "",
    bestBeforeDate: prefill?.bestBeforeDate ?? "",
    storageCondition: prefill?.storageCondition ?? "",
    ripeningState: prefill?.ripeningState ?? "",
    qualityStatus: prefill?.qualityStatus ?? "Released",
    temperatureAtReceiptC: prefill?.temperatureAtReceiptC ?? "",
    temperatureBreach: prefill?.temperatureBreach ?? false,
    qualityHoldReason: prefill?.qualityHoldReason ?? "",
    locationId: prefill?.locationId ?? "",
  };
}

function num(value: string): number {
  return Number(value);
}

function prettyQty(value: number) {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });
}

function toneForBand(band: StockItemRow["expiryBand"]) {
  if (band === "expired") return "danger";
  if (band === "critical") return "warning";
  if (band === "warning") return "warning";
  if (band === "ok") return "success";
  return "outline";
}

export function StockManager({
  stock,
  warehouses,
  containers,
  inwardContainers = [],
  gatePasses,
  locations,
  cycleCounts,
  canReceive,
  canAdjust,
  canFulfil,
  viewMode = "stock",
}: {
  stock: StockItemRow[];
  warehouses: WarehouseOption[];
  containers: ReceiveContainer[];
  inwardContainers?: WarehouseInwardContainer[];
  gatePasses: GatePassRow[];
  locations: WarehouseLocationOption[];
  cycleCounts: WarehouseCycleCountOption[];
  canReceive: boolean;
  canAdjust: boolean;
  canFulfil: boolean;
  viewMode?: "stock" | "inward" | "processing" | "dispatch";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const boardPreferences = useMemo(() => readBoardPreferences(), []);
  const [boardSearch, setBoardSearch] = useState(boardPreferences.boardSearch);
  const [boardFilter, setBoardFilter] = useState<BoardFilterMode>(boardPreferences.boardFilter);
  const [visibleBoardStatuses, setVisibleBoardStatuses] = useState<(typeof BOARD_STATUSES)[number][]>(
    boardPreferences.visibleBoardStatuses
  );
  const [boardPresets, setBoardPresets] = useState<BoardPreset[]>(boardPreferences.presets);
  const [activeBoardPresetId, setActiveBoardPresetId] = useState<string | null>(
    boardPreferences.activePresetId
  );
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationForm, setLocationForm] = useState({
    warehouseId: warehouses[0]?.id ?? "",
    parentId: "",
    code: "",
    name: "",
    type: "Room" as WarehouseLocationOption["type"],
    capacityUnits: "",
    temperatureMinC: "",
    temperatureMaxC: "",
    notes: "",
  });
  const [selectedContainerId, setSelectedContainerId] = useState("");
  const [rows, setRows] = useState<ReceiveRowState[]>([blankRow()]);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeSourceId, setGradeSourceId] = useState("");
  const [gradeRows, setGradeRows] = useState<ReceiveRowState[]>([blankRow()]);
  const [gradeReason, setGradeReason] = useState("");
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchSourceId, setDispatchSourceId] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [dispatchVehicleNo, setDispatchVehicleNo] = useState("");
  const [dispatchDriverName, setDispatchDriverName] = useState("");
  const [dispatchDriverContact, setDispatchDriverContact] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [dispatchExceptionReason, setDispatchExceptionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [draggedPassId, setDraggedPassId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<(typeof BOARD_STATUSES)[number] | null>(null);
  const [selectedStockItemId, setSelectedStockItemId] = useState<string | null>(null);
  const [movementRows, setMovementRows] = useState<StockMovementRow[]>([]);
  const [movementBusy, setMovementBusy] = useState(false);
  const [stockActionDialog, setStockActionDialog] = useState<StockActionDialogState>({
    open: false,
    stockItemId: "",
    action: "reserve",
    qty: "1",
    direction: "decrease",
    reason: "",
    evidenceRef: "",
  });
  const [qualityDialog, setQualityDialog] = useState<QualityDialogState>({
    open: false,
    stockItemId: "",
    qualityStatus: "Released",
    reason: "",
  });
  const [transferDialog, setTransferDialog] = useState<TransferDialogState>({
    open: false,
    stockItemId: "",
    locationId: "",
    reason: "",
  });
  const [presetDialog, setPresetDialog] = useState<PresetDialogState>({
    open: false,
    mode: "save",
    name: "",
  });
  const [fleetDialog, setFleetDialog] = useState<FleetDialogState>({
    open: false,
    gatePassId: "",
    vehicleNo: "",
    driverName: "",
    driverContact: "",
    vehicleSealNo: "",
    loadingPhotoRef: "",
    routeName: "",
    beatName: "",
    deliveryInstructions: "",
    returnCratesPlanned: "",
    returnPalletsPlanned: "",
    loadingPhotoFile: null,
    notes: "",
  });
  const [gateDialog, setGateDialog] = useState<GateDialogState>({
    open: false,
    gatePassId: "",
    securityOtp: "",
  });
  const [podDialog, setPodDialog] = useState<PodDialogState>({
    open: false,
    gatePassId: "",
    podRef: "",
    podAcknowledgedBy: "",
    returnCratesReceived: "",
    returnPalletsReceived: "",
    podFile: null,
  });
  const [scanCode, setScanCode] = useState("");
  const [deletePresetOpen, setDeletePresetOpen] = useState(false);

  const selectedContainer =
    containers.find((c) => c.id === selectedContainerId) ?? null;
  const gradeSource = stock.find((entry) => entry.id === gradeSourceId) ?? null;
  const dispatchSource = stock.find((entry) => entry.id === dispatchSourceId) ?? null;
  const fleetGatePass = gatePasses.find((pass) => pass.id === fleetDialog.gatePassId) ?? null;
  const gateTarget = gatePasses.find((pass) => pass.id === gateDialog.gatePassId) ?? null;
  const podTarget = gatePasses.find((pass) => pass.id === podDialog.gatePassId) ?? null;
  const selectedStock = stock.find((entry) => entry.id === selectedStockItemId) ?? null;
  const stockActionTarget =
    stock.find((entry) => entry.id === stockActionDialog.stockItemId) ?? null;
  const qualityTarget = stock.find((entry) => entry.id === qualityDialog.stockItemId) ?? null;
  const transferTarget = stock.find((entry) => entry.id === transferDialog.stockItemId) ?? null;
  const transferLocations = useMemo(
    () =>
      transferTarget
        ? locations.filter(
            (location) =>
              location.warehouseId === transferTarget.warehouseId &&
              location.isActive &&
              location.id !== transferTarget.locationId
          )
        : [],
    [locations, transferTarget]
  );
  const warehouseLocations = useMemo(
    () => locations.filter((location) => warehouseId === "all" || location.warehouseId === warehouseId),
    [locations, warehouseId]
  );
  const warehouseCycleCounts = useMemo(
    () => cycleCounts.filter((count) => warehouseId === "all" || count.warehouseId === warehouseId),
    [cycleCounts, warehouseId]
  );

  const receiveTotal = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const qty = Number(row.qtyReceived);
        return Number.isFinite(qty) ? sum + qty : sum;
      }, 0),
    [rows]
  );
  const gradeTotal = useMemo(
    () =>
      gradeRows.reduce((sum, row) => {
        const qty = Number(row.qtyReceived);
        return Number.isFinite(qty) ? sum + qty : sum;
      }, 0),
    [gradeRows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.filter((row) => {
      const matchesWarehouse =
        warehouseId === "all" || row.warehouseId === warehouseId;
      const matchesQuery =
        !q ||
        [row.containerNo, row.blNo, row.item, row.variety, row.grade, row.lotNo, row.palletNo]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return matchesWarehouse && matchesQuery;
    });
  }, [stock, query, warehouseId]);

  const expiryStats = useMemo(() => {
    const critical = filtered.filter((row) =>
      ["expired", "critical"].includes(row.expiryBand)
    ).length;
    const warning = filtered.filter((row) => row.expiryBand === "warning").length;
    const reserved = filtered.filter((row) => row.qtyReserved > 0).length;
    const byUom = new Map<string, number>();
    for (const row of filtered) {
      byUom.set(row.uom, (byUom.get(row.uom) ?? 0) + row.qtyAvailable);
    }
    return { critical, warning, reserved, byUom };
  }, [filtered]);
  const locationSummary = useMemo(
    () => ({
      rooms: warehouseLocations.filter((location) => location.type === "Room").length,
      zones: warehouseLocations.filter((location) => location.type === "Zone").length,
      bins: warehouseLocations.filter((location) => location.type === "Bin").length,
    }),
    [warehouseLocations]
  );

  const dispatchStageCounts = useMemo(() => {
    const stages = ["Picked", "Packed", "Ready", "PartiallyDispatched"] as const;
    return stages.map((stage) => ({
      stage,
      count: gatePasses.filter((pass) => pass.status === stage).length,
    }));
  }, [gatePasses]);
  const boardColumns = useMemo(
    () =>
      BOARD_STATUSES.map((status) => ({
        status,
        items: gatePasses
          .filter((pass) => pass.status === status)
          .sort((a, b) => {
            const aKey = a.nextFefoDate
              ? new Date(a.nextFefoDate).getTime()
              : Number.MAX_SAFE_INTEGER;
            const bKey = b.nextFefoDate
              ? new Date(b.nextFefoDate).getTime()
              : Number.MAX_SAFE_INTEGER;
            if (aKey !== bKey) return aKey - bKey;
            return a.createdAt.localeCompare(b.createdAt);
          }),
        })),
    [gatePasses]
  );
  const filteredBoardColumns = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    const visibleStatuses = new Set(visibleBoardStatuses);
    return boardColumns
      .filter((column) => visibleStatuses.has(column.status))
      .map((column) => ({
        ...column,
        items: column.items.filter((pass) => {
          const matchesFilter =
            boardFilter === "all"
              ? true
              : boardFilter === "active"
                ? ACTIVE_BOARD_STATUSES.has(pass.status)
                : CLOSED_BOARD_STATUSES.has(pass.status);
          const matchesQuery =
            !q ||
            [
              pass.gatePassNo,
              pass.salesOrderNo,
              pass.customerName,
              pass.containerNo,
              pass.blNo,
              pass.vehicleNo,
              pass.driverName,
              pass.notes,
            ]
              .filter(Boolean)
              .some((value) => value!.toLowerCase().includes(q));
          return matchesFilter && matchesQuery;
        }),
      }));
  }, [boardFilter, boardSearch, boardColumns, visibleBoardStatuses]);
  const filteredBoardCount = useMemo(
    () => filteredBoardColumns.reduce((sum, column) => sum + column.items.length, 0),
    [filteredBoardColumns]
  );
  const activeBoardPreset = boardPresets.find((preset) => preset.id === activeBoardPresetId) ?? null;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BOARD_STORAGE_KEY,
        JSON.stringify(
          storageStateFromValues({
            boardSearch,
            boardFilter,
            visibleBoardStatuses,
            activePresetId: activeBoardPresetId,
            presets: boardPresets,
          })
        )
      );
    } catch {
      // Ignore storage failures in private browsing or locked-down environments.
    }
  }, [activeBoardPresetId, boardFilter, boardSearch, boardPresets, visibleBoardStatuses]);

  function applyBoardPreset(preset: BoardPreset) {
    setBoardSearch(preset.boardSearch);
    setBoardFilter(preset.boardFilter);
    setVisibleBoardStatuses(preset.visibleBoardStatuses);
    setActiveBoardPresetId(preset.id);
  }

  function openSaveBoardPresetDialog() {
    setPresetDialog({
      open: true,
      mode: "save",
      name: activeBoardPreset?.name ?? "Warehouse view",
    });
  }

  function openRenameBoardPresetDialog() {
    if (!activeBoardPreset) return;
    setPresetDialog({
      open: true,
      mode: "rename",
      name: activeBoardPreset.name,
    });
  }

  function submitBoardPresetDialog() {
    const name = presetDialog.name.trim();
    if (!name) {
      toast.error("Preset name is required");
      return;
    }
    const duplicate = boardPresets.find(
      (preset) =>
        preset.name.trim().toLowerCase() === name.toLowerCase() &&
        preset.id !== (presetDialog.mode === "rename" ? activeBoardPreset?.id : activeBoardPreset?.id)
    );
    if (duplicate) {
      toast.error(`Preset "${name}" already exists`);
      return;
    }
    if (presetDialog.mode === "rename") {
      if (!activeBoardPreset || name === activeBoardPreset.name) {
        setPresetDialog((current) => ({ ...current, open: false }));
        return;
      }
      setBoardPresets((presets) =>
        presets
          .map((preset) =>
            preset.id === activeBoardPreset.id ? { ...preset, name } : preset
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success("Preset renamed");
      setPresetDialog((current) => ({ ...current, open: false }));
      return;
    }

    const current = {
      boardSearch,
      boardFilter,
      visibleBoardStatuses,
    };
    setBoardPresets((presets) => {
      const existing = presets.find((preset) => preset.id === activeBoardPreset?.id);
      const next: BoardPreset = {
        id: existing?.id ?? nextPresetId(name, presets),
        name,
        ...current,
      };
      const updated = existing
        ? presets.map((preset) => (preset.id === existing.id ? next : preset))
        : [...presets, next];
      setActiveBoardPresetId(next.id);
      return updated.sort((a, b) => a.name.localeCompare(b.name));
    });
    toast.success("Preset saved");
    setPresetDialog((dialog) => ({ ...dialog, open: false }));
  }

  function deleteBoardPreset() {
    if (!activeBoardPreset) return;
    setBoardPresets((presets) => presets.filter((preset) => preset.id !== activeBoardPreset.id));
    setActiveBoardPresetId(null);
    setDeletePresetOpen(false);
    toast.success("Preset deleted");
  }

  function handleContainerChange(value: string) {
    setSelectedContainerId(value);
    const container = containers.find((entry) => entry.id === value);
    setRows([
      blankRow({
        item: container?.item ?? "",
        variety: container?.variety ?? "",
        uom: "Box",
        qtyReceived: container?.noOfBoxes != null ? String(container.noOfBoxes) : "",
      }),
    ]);
  }

  function openGradeDialog(row: StockItemRow) {
    setGradeSourceId(row.id);
    setGradeReason("");
    setGradeRows([
      blankRow({
        item: row.item,
        variety: row.variety ?? "",
        uom: row.uom,
        lotNo: row.lotNo ?? "",
        palletNo: row.palletNo ?? "",
        packDate: row.packDate ?? "",
        expiryDate: row.expiryDate ?? "",
        bestBeforeDate: row.bestBeforeDate ?? "",
        storageCondition: row.storageCondition ?? "",
        ripeningState: row.ripeningState ?? "",
      }),
    ]);
    setGradeOpen(true);
  }

  function openReceiveDialog() {
    if (selectedContainer) {
      setRows([
        blankRow({
          item: selectedContainer.item ?? "",
          variety: selectedContainer.variety ?? "",
          uom: "Box",
          qtyReceived:
            selectedContainer.noOfBoxes != null ? String(selectedContainer.noOfBoxes) : "",
        }),
      ]);
    } else {
      setRows([blankRow()]);
    }
    setReceiveOpen(true);
  }

  async function loadMovementHistory(stockItemId: string) {
    setSelectedStockItemId(stockItemId);
    setMovementBusy(true);
    try {
      const res = await fetch(`/api/warehouse-stock/${stockItemId}/movements`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to load stock history");
        return;
      }
      setMovementRows(json.data as StockMovementRow[]);
    } catch {
      toast.error("Network error");
    } finally {
      setMovementBusy(false);
    }
  }

  function openDispatchDialog(row: StockItemRow) {
    setDispatchSourceId(row.id);
    setDispatchQty(String(row.qtyAvailable));
    setDispatchVehicleNo("");
    setDispatchDriverName("");
    setDispatchNotes("");
    setDispatchExceptionReason("");
    setDispatchOpen(true);
  }

  async function submitReceipt() {
    if (!selectedContainerId) {
      toast.error("Choose a container first");
      return;
    }
    if (receiveTotal <= 0) {
      toast.error("Enter a positive received quantity");
      return;
    }
    if (rows.some((row) => !row.item.trim())) {
      toast.error("Every receipt line needs an item name");
      return;
    }
    if (rows.some((row) => !row.qtyReceived || Number(row.qtyReceived) <= 0)) {
      toast.error("Every receipt line needs a positive quantity");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        containerId: selectedContainerId,
        rows: rows.map((row) => ({
          item: row.item.trim(),
          variety: row.variety.trim() || undefined,
          grade: row.grade.trim() || undefined,
          uom: row.uom,
          qtyReceived: num(row.qtyReceived),
          perUnitWeightKg: row.perUnitWeightKg ? num(row.perUnitWeightKg) : undefined,
          lotNo: row.lotNo.trim() || undefined,
          palletNo: row.palletNo.trim() || undefined,
          packDate: row.packDate || undefined,
          expiryDate: row.expiryDate || undefined,
          bestBeforeDate: row.bestBeforeDate || undefined,
          storageCondition: row.storageCondition.trim() || undefined,
          ripeningState: row.ripeningState.trim() || undefined,
          qualityStatus: row.temperatureBreach ? "Quarantine" : row.qualityStatus,
          temperatureAtReceiptC: row.temperatureAtReceiptC
            ? num(row.temperatureAtReceiptC)
            : undefined,
          temperatureBreach: row.temperatureBreach,
          qualityHoldReason: row.qualityHoldReason.trim() || undefined,
          locationId: row.locationId || undefined,
        })),
      };
      const res = await fetch("/api/warehouse-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to receive stock");
        return;
      }
      toast.success(`Received ${json.data.created.length} stock line(s)`);
      setReceiveOpen(false);
      setSelectedContainerId("");
      setRows([blankRow()]);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function submitGrade() {
    if (!gradeSourceId) {
      toast.error("Choose a source lot first");
      return;
    }
    if (gradeTotal <= 0) {
      toast.error("Enter a positive split quantity");
      return;
    }
    if (gradeTotal > (gradeSource?.qtyAvailable ?? 0)) {
      toast.error("Split quantity exceeds available stock");
      return;
    }
    if (gradeRows.some((row) => !row.grade.trim())) {
      toast.error("Every split line needs a grade");
      return;
    }
    if (gradeRows.some((row) => !row.item.trim())) {
      toast.error("Every split line needs an item name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/warehouse-stock/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: gradeSourceId,
          reason: gradeReason || undefined,
          rows: gradeRows.map((row) => ({
            item: row.item.trim() || undefined,
            variety: row.variety.trim() || undefined,
            grade: row.grade.trim(),
            uom: row.uom,
            qtySplit: num(row.qtyReceived),
            perUnitWeightKg: row.perUnitWeightKg ? num(row.perUnitWeightKg) : undefined,
            lotNo: row.lotNo.trim() || undefined,
            palletNo: row.palletNo.trim() || undefined,
            packDate: row.packDate || undefined,
            expiryDate: row.expiryDate || undefined,
            bestBeforeDate: row.bestBeforeDate || undefined,
            storageCondition: row.storageCondition.trim() || undefined,
            ripeningState: row.ripeningState.trim() || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to grade stock");
        return;
      }
      toast.success(`Graded into ${json.data.childLots.length} lot(s)`);
      setGradeOpen(false);
      setGradeSourceId("");
      setGradeRows([blankRow()]);
      setGradeReason("");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function submitDispatch() {
    if (!dispatchSource) {
      toast.error("Choose a source lot first");
      return;
    }
    const qty = Number(dispatchQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid dispatch quantity");
      return;
    }
    if (qty > dispatchSource.qtyAvailable) {
      toast.error("Dispatch quantity exceeds available stock");
      return;
    }
    if (dispatchExceptionReason.trim().length < 5) {
      toast.error("Explain why this dispatch is not linked to a sales order");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/warehouse-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: dispatchSource.warehouseId,
          containerId: dispatchSource.containerId,
          vehicleNo: dispatchVehicleNo || undefined,
          driverName: dispatchDriverName || undefined,
          driverContact: dispatchDriverContact || undefined,
          notes: dispatchNotes || undefined,
          exceptionReason: dispatchExceptionReason.trim(),
          lines: [
            {
              stockItemId: dispatchSource.id,
              qty,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create gate pass");
        return;
      }
      toast.success("Gate pass created and stock reserved");
      setDispatchOpen(false);
      setDispatchSourceId("");
      setDispatchQty("");
      setDispatchVehicleNo("");
      setDispatchDriverName("");
      setDispatchDriverContact("");
      setDispatchNotes("");
      setDispatchExceptionReason("");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function runGatePassAction(gatePassId: string, action: "pack" | "ready" | "dispatch" | "cancel") {
    if (!canFulfil) return;
    setActionBusyId(gatePassId);
    try {
      const res = await fetch("/api/warehouse-dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatePassId, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gate pass action failed");
        return;
      }
      toast.success(`Gate pass ${action} complete`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  function openFleetDialog(pass: GatePassRow) {
    setFleetDialog({
      open: true,
      gatePassId: pass.id,
      vehicleNo: pass.vehicleNo ?? "",
      driverName: pass.driverName ?? "",
      driverContact: pass.driverContact ?? "",
      vehicleSealNo: pass.vehicleSealNo ?? "",
      loadingPhotoRef: pass.loadingPhotoRef ?? "",
      routeName: pass.routeName ?? "",
      beatName: pass.beatName ?? "",
      deliveryInstructions: pass.deliveryInstructions ?? "",
      returnCratesPlanned: pass.returnCratesPlanned ? String(pass.returnCratesPlanned) : "",
      returnPalletsPlanned: pass.returnPalletsPlanned ? String(pass.returnPalletsPlanned) : "",
      loadingPhotoFile: null,
      notes: pass.notes ?? "",
    });
  }

  function openGateDialog(pass: GatePassRow) {
    setGateDialog({
      open: true,
      gatePassId: pass.id,
      securityOtp: "",
    });
  }

  function openPodDialog(pass: GatePassRow) {
    setPodDialog({
      open: true,
      gatePassId: pass.id,
      podRef: pass.podRef ?? "",
      podAcknowledgedBy: pass.podAcknowledgedBy ?? "",
      returnCratesReceived: pass.returnCratesReceived ? String(pass.returnCratesReceived) : "",
      returnPalletsReceived: pass.returnPalletsReceived ? String(pass.returnPalletsReceived) : "",
      podFile: null,
    });
  }

  async function submitFleetDetails() {
    if (!canFulfil || !fleetDialog.gatePassId) return;
    setActionBusyId(fleetDialog.gatePassId);
    try {
      let loadingPhotoRef = fleetDialog.loadingPhotoRef || undefined;
      if (fleetDialog.loadingPhotoFile) {
        loadingPhotoRef = await uploadDispatchProof(
          fleetDialog.gatePassId,
          fleetDialog.loadingPhotoFile
        );
      }
      const res = await fetch("/api/warehouse-dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatePassId: fleetDialog.gatePassId,
          action: "fleet",
          vehicleNo: fleetDialog.vehicleNo,
          driverName: fleetDialog.driverName,
          driverContact: fleetDialog.driverContact || undefined,
          vehicleSealNo: fleetDialog.vehicleSealNo || undefined,
          loadingPhotoRef,
          routeName: fleetDialog.routeName || undefined,
          beatName: fleetDialog.beatName || undefined,
          deliveryInstructions: fleetDialog.deliveryInstructions || undefined,
          returnCratesPlanned: fleetDialog.returnCratesPlanned || undefined,
          returnPalletsPlanned: fleetDialog.returnPalletsPlanned || undefined,
          notes: fleetDialog.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save fleet details");
        return;
      }
      toast.success("Fleet details logged");
      setFleetDialog({
        open: false,
        gatePassId: "",
        vehicleNo: "",
        driverName: "",
        driverContact: "",
        vehicleSealNo: "",
        loadingPhotoRef: "",
        routeName: "",
        beatName: "",
        deliveryInstructions: "",
        returnCratesPlanned: "",
        returnPalletsPlanned: "",
        loadingPhotoFile: null,
        notes: "",
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  async function submitGateExit() {
    if (!canFulfil || !gateDialog.gatePassId) return;
    setActionBusyId(gateDialog.gatePassId);
    try {
      const res = await fetch("/api/warehouse-dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatePassId: gateDialog.gatePassId,
          action: "gate",
          securityOtp: gateDialog.securityOtp,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Security gate confirmation failed");
        return;
      }
      toast.success("Security gate exit confirmed");
      setGateDialog({ open: false, gatePassId: "", securityOtp: "" });
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  async function submitPodAndReturns() {
    if (!canFulfil || !podDialog.gatePassId) return;
    setActionBusyId(podDialog.gatePassId);
    try {
      let podRef = podDialog.podRef || undefined;
      if (podDialog.podFile) {
        podRef = await uploadDispatchProof(podDialog.gatePassId, podDialog.podFile, "pod");
      }
      const podRes = await fetch("/api/warehouse-dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatePassId: podDialog.gatePassId,
          action: "pod",
          podRef,
          podAcknowledgedBy: podDialog.podAcknowledgedBy,
        }),
      });
      const podJson = await podRes.json();
      if (!podRes.ok) {
        toast.error(podJson.error ?? "POD acknowledgement failed");
        return;
      }
      const returnsRes = await fetch("/api/warehouse-dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatePassId: podDialog.gatePassId,
          action: "returns",
          returnCratesReceived: podDialog.returnCratesReceived || undefined,
          returnPalletsReceived: podDialog.returnPalletsReceived || undefined,
        }),
      });
      const returnsJson = await returnsRes.json();
      if (!returnsRes.ok) {
        toast.error(returnsJson.error ?? "Return asset update failed");
        return;
      }
      toast.success("POD and return assets updated");
      setPodDialog({
        open: false,
        gatePassId: "",
        podRef: "",
        podAcknowledgedBy: "",
        returnCratesReceived: "",
        returnPalletsReceived: "",
        podFile: null,
      });
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  async function moveGatePassToStatus(
    pass: GatePassRow,
    targetStatus: (typeof BOARD_STATUSES)[number]
  ) {
    if (!canFulfil || pass.status === targetStatus) return;
    if (pass.status === "Cancelled" || pass.status === "Dispatched") return;

    const action =
      targetStatus === "Packed"
        ? "pack"
        : targetStatus === "Ready"
          ? "ready"
          : targetStatus === "PartiallyDispatched" || targetStatus === "Dispatched"
            ? "dispatch"
            : targetStatus === "Cancelled"
              ? "cancel"
              : null;

    if (!action) return;
    await runGatePassAction(pass.id, action);
  }

  function toggleBoardStatusVisibility(status: (typeof BOARD_STATUSES)[number]) {
    setVisibleBoardStatuses((current) =>
      current.includes(status)
        ? current.filter((entry) => entry !== status)
        : [...current, status]
    );
  }

  function handleBoardDrop(
    targetStatus: (typeof BOARD_STATUSES)[number],
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    const passId = event.dataTransfer.getData("text/plain") || draggedPassId;
    setDragOverStatus(null);
    setDraggedPassId(null);
    if (!passId) return;
    const pass = gatePasses.find((row) => row.id === passId);
    if (!pass) return;
    void moveGatePassToStatus(pass, targetStatus);
  }

  function openStockActionDialog(row: StockItemRow, action: StockActionKind) {
    setStockActionDialog({
      open: true,
      stockItemId: row.id,
      action,
      qty: "1",
      direction: "decrease",
      reason: "",
      evidenceRef: "",
    });
  }

  function openQualityDialog(row: StockItemRow) {
    setQualityDialog({
      open: true,
      stockItemId: row.id,
      qualityStatus: row.qualityStatus,
      reason: row.qualityHoldReason ?? "",
    });
  }

  function openTransferDialog(row: StockItemRow) {
    const fallbackLocation =
      locations.find(
        (location) =>
          location.warehouseId === row.warehouseId &&
          location.isActive &&
          location.id !== row.locationId
      )?.id ?? "";
    setTransferDialog({
      open: true,
      stockItemId: row.id,
      locationId: fallbackLocation,
      reason: "",
    });
  }

  async function submitStockAction() {
    if (!canAdjust || !stockActionTarget) return;
    const qty = Number(stockActionDialog.qty);
    const reason = stockActionDialog.reason.trim();
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (reason.length < 3) {
      toast.error("A reason is required for the stock trail");
      return;
    }
    if (
      ["wastage", "dump"].includes(stockActionDialog.action) &&
      stockActionDialog.evidenceRef.trim().length < 3
    ) {
      toast.error("Add evidence or inspection reference for wastage/dump");
      return;
    }

    setActionBusyId(stockActionTarget.id);
    try {
      const isDamageAction = ["wastage", "dump"].includes(stockActionDialog.action);
      const res = await fetch("/api/warehouse-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: stockActionTarget.id,
          action: stockActionDialog.action,
          qty,
          direction:
            stockActionDialog.action === "adjust"
              ? stockActionDialog.direction
              : undefined,
          reason,
          refType: isDamageAction ? "DamageEvidence" : "warehouse_stock",
          refId: isDamageAction
            ? stockActionDialog.evidenceRef.trim()
            : stockActionTarget.containerId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Action failed");
        return;
      }
      toast.success(`Stock ${stockActionDialog.action} complete`);
      setStockActionDialog((current) => ({ ...current, open: false }));
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  async function submitQualityAction() {
    if (!canAdjust || !qualityTarget) return;
    const reason = qualityDialog.reason.trim();
    if (reason.length < 3) {
      toast.error("A quality decision reason is required");
      return;
    }
    setActionBusyId(qualityTarget.id);
    try {
      const res = await fetch("/api/warehouse-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: qualityTarget.id,
          action: "quality",
          qualityStatus: qualityDialog.qualityStatus,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Quality update failed");
        return;
      }
      toast.success(`Quality status changed to ${qualityDialog.qualityStatus}`);
      setQualityDialog((current) => ({ ...current, open: false }));
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  async function submitTransferAction() {
    if (!canAdjust || !transferTarget) return;
    const reason = transferDialog.reason.trim();
    if (!transferDialog.locationId) {
      toast.error("Choose the destination location");
      return;
    }
    if (reason.length < 3) {
      toast.error("A transfer reason is required");
      return;
    }

    setActionBusyId(transferTarget.id);
    try {
      const res = await fetch("/api/warehouse-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: transferTarget.id,
          action: "transfer",
          locationId: transferDialog.locationId,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Transfer failed");
        return;
      }
      toast.success("Lot location transferred");
      setTransferDialog((current) => ({ ...current, open: false }));
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  async function createLocation() {
    if (!locationForm.warehouseId || !locationForm.code.trim() || !locationForm.name.trim()) {
      toast.error("Warehouse, location code, and name are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/warehouse-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "location",
          ...locationForm,
          parentId: locationForm.parentId || undefined,
          capacityUnits: locationForm.capacityUnits || undefined,
          temperatureMinC: locationForm.temperatureMinC || undefined,
          temperatureMaxC: locationForm.temperatureMaxC || undefined,
          notes: locationForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create location");
        return;
      }
      toast.success("Warehouse location created");
      setLocationOpen(false);
      setLocationForm((current) => ({ ...current, parentId: "", code: "", name: "", capacityUnits: "", notes: "" }));
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  function addRow() {
    setRows((current) => [...current, blankRow()]);
  }

  function removeRow(index: number) {
    setRows((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  function addGradeRow() {
    setGradeRows((current) => [...current, blankRow()]);
  }

  function removeGradeRow(index: number) {
    setGradeRows((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  const showInwardWorkspace = viewMode === "inward";
  const showStockWorkspace = viewMode === "stock" || viewMode === "processing";
  const showDispatchWorkspace = viewMode === "dispatch";
  const routeBeatSummary = useMemo(() => {
    const groups = new Map<string, { route: string; beat: string; count: number; pending: number }>();
    for (const pass of gatePasses) {
      const route = pass.routeName ?? "Unplanned route";
      const beat = pass.beatName ?? "No beat";
      const key = `${route}::${beat}`;
      const current = groups.get(key) ?? { route, beat, count: 0, pending: 0 };
      current.count += 1;
      if (pass.status !== "Dispatched" && pass.status !== "Cancelled") current.pending += 1;
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.pending - a.pending);
  }, [gatePasses]);
  const slaRows = useMemo(() => buildDispatchSlaRows(gatePasses), [gatePasses]);
  const scanMatch = useMemo(() => {
    const q = scanCode.trim().toLowerCase();
    if (!q) return null;
    return (
      gatePasses.find((pass) =>
        [
          pass.gatePassNo,
          pass.salesOrderNo,
          pass.containerNo,
          pass.blNo,
          pass.vehicleNo,
          pass.driverName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) ?? null
    );
  }, [gatePasses, scanCode]);

  return (
    <div className="space-y-4">
      <WarehouseProcessStory viewMode={viewMode} />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Lots" value={filtered.length.toString()} />
        <SummaryCard label="Critical" value={expiryStats.critical.toString()} tone="danger" />
        <SummaryCard label="Warning" value={expiryStats.warning.toString()} tone="warning" />
        <SummaryCard label="Reserved Lots" value={expiryStats.reserved.toString()} tone="success" />
      </div>

      {showInwardWorkspace ? (
        <WarehouseInwardBoard
          containers={inwardContainers}
          stock={stock}
          canReceive={canReceive}
          onReceive={openReceiveDialog}
        />
      ) : null}

      {showStockWorkspace ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:flex-1 lg:grid-cols-3">
              <Field label="Search">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Container, BL, item, lot..."
                />
              </Field>
              <Field label="Warehouse">
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All warehouses</SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code}) - {warehouse.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-1.5">
                <Label>UoM mix</Label>
                <div className="flex flex-wrap gap-2">
                  {Array.from(expiryStats.byUom.entries()).length === 0 ? (
                    <span className="text-sm text-muted-foreground">No stock yet</span>
                  ) : (
                    Array.from(expiryStats.byUom.entries()).map(([uom, qty]) => (
                      <Badge key={uom} variant="outline" className="gap-1">
                        {uom} <span className="font-financial">{prettyQty(qty)}</span>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canAdjust && (
                <Button variant="outline" onClick={() => setLocationOpen(true)}>
                  <Plus className="h-4 w-4" /> Location
                </Button>
              )}
              {canReceive && (
                <Button
                  onClick={openReceiveDialog}
                  disabled={containers.length === 0}
                >
                  <Plus className="h-4 w-4" /> Receive Stock
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showDispatchWorkspace ? (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label-caps">Fulfilment Board</p>
            <h3 className="font-heading text-lg font-semibold">Pick, pack, ready, dispatch</h3>
          </div>
          <Badge variant="outline">{filteredBoardCount} open</Badge>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface-alt/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rooms / Zones / Bins</p>
            <p className="mt-1 font-financial text-2xl font-semibold">
              {locationSummary.rooms}/{locationSummary.zones}/{locationSummary.bins}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Directed putaway and pick use this location tree.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt/30 p-3 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Locations</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {warehouseLocations.length === 0 ? (
                <span className="text-sm text-muted-foreground">No locations configured yet.</span>
              ) : (
                warehouseLocations.slice(0, 8).map((location) => (
                  <Badge key={location.id} variant={location.isActive ? "outline" : "danger"}>
                    {location.code} - {location.type}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt/30 p-3 md:col-span-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cycle Counts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {warehouseCycleCounts.length === 0 ? (
                <span className="text-sm text-muted-foreground">No cycle counts logged yet.</span>
              ) : (
                warehouseCycleCounts.slice(0, 6).map((count) => (
                  <Badge key={count.id} variant={count.status === "Completed" ? "success" : count.status === "InProgress" ? "warning" : "outline"}>
                    {count.countNo} - {count.status} - {count.lineCount} lines
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="board-search">Search board</Label>
            <Input
              id="board-search"
              value={boardSearch}
              onChange={(event) => {
                setActiveBoardPresetId(null);
                setBoardSearch(event.target.value);
              }}
              placeholder="Search gate pass, order, customer, container, vehicle..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={boardFilter === "all" ? "default" : "outline"}
              onClick={() => {
                setActiveBoardPresetId(null);
                setBoardFilter("all");
              }}
            >
              All
            </Button>
            <Button
              type="button"
              variant={boardFilter === "active" ? "default" : "outline"}
              onClick={() => {
                setActiveBoardPresetId(null);
                setBoardFilter("active");
              }}
            >
              Active
            </Button>
            <Button
              type="button"
              variant={boardFilter === "closed" ? "default" : "outline"}
              onClick={() => {
                setActiveBoardPresetId(null);
                setBoardFilter("closed");
              }}
            >
              Closed
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="board-preset">Saved presets</Label>
            <Select
              value={activeBoardPresetId ?? "__custom__"}
              onValueChange={(value) => {
                if (value === "__custom__") {
                  setActiveBoardPresetId(null);
                  return;
                }
                const preset = boardPresets.find((entry) => entry.id === value);
                if (preset) applyBoardPreset(preset);
              }}
            >
              <SelectTrigger id="board-preset">
                <SelectValue placeholder="Custom view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">Custom view</SelectItem>
                {boardPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={openSaveBoardPresetDialog}>
              Save preset
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openRenameBoardPresetDialog}
              disabled={!activeBoardPreset}
            >
              Rename preset
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletePresetOpen(true)}
              disabled={!activeBoardPreset}
            >
              Delete preset
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {BOARD_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={visibleBoardStatuses.includes(status) ? "secondary" : "outline"}
              onClick={() => {
                setActiveBoardPresetId(null);
                toggleBoardStatusVisibility(status);
              }}
            >
              {BOARD_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {dispatchStageCounts.map((stage) => (
            <div key={stage.stage} className="rounded-xl border border-border bg-surface-alt/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{stage.stage}</p>
              <p className="mt-1 font-financial text-2xl font-semibold">{stage.count}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-border bg-surface-alt/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-caps">Mobile scan mode</p>
                <h4 className="font-heading text-base font-semibold">Scan GRN, pick sheet, gate pass, or vehicle</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use this on a phone/tablet at receiving, packing, billing, or security gate.
                </p>
              </div>
              <Badge variant={scanMatch ? "success" : "outline"}>
                {scanMatch ? "Matched" : "Ready"}
              </Badge>
            </div>
            <Input
              className="mt-3"
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value)}
              placeholder="Scan or type gate pass / order / vehicle / BL"
            />
            {scanMatch ? (
              <div className="mt-3 rounded-xl border border-border bg-card p-3 text-sm">
                <p className="font-medium">{scanMatch.gatePassNo}</p>
                <p className="text-muted-foreground">
                  {scanMatch.customerName ?? "No customer"} - {scanMatch.status}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openFleetDialog(scanMatch)}>
                    Dispatch control
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openGateDialog(scanMatch)}>
                    Security OTP
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openPodDialog(scanMatch)}>
                    POD / returns
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No scan selected. Scanning does not change stock until the operator confirms an action.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface-alt/25 p-4">
            <p className="label-caps">Route / beat plan</p>
            <h4 className="font-heading text-base font-semibold">City dispatch planning</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {routeBeatSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">Log route and beat in dispatch control to build the city plan.</p>
              ) : (
                routeBeatSummary.slice(0, 6).map((route) => (
                  <div key={`${route.route}-${route.beat}`} className="rounded-xl border border-border bg-card p-3">
                    <p className="font-medium">{route.route}</p>
                    <p className="text-xs text-muted-foreground">{route.beat}</p>
                    <p className="mt-2 font-financial text-lg font-semibold">{route.pending}/{route.count}</p>
                    <p className="text-xs text-muted-foreground">pending / total loads</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface-alt/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label-caps">Dispatch SLA dashboard</p>
              <h4 className="font-heading text-base font-semibold">Picker, packer, billing, security, driver handoffs</h4>
            </div>
            <Badge variant="outline">Live from gate-pass timestamps</Badge>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            {slaRows.map((row) => (
              <div key={row.role} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.role}</p>
                <p className={cn("mt-1 font-financial text-2xl font-semibold", row.tone)}>
                  {row.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{row.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {filteredBoardColumns.map((column) => (
            <div
              key={column.status}
              onDragOver={(event) => {
                if (!canFulfil) return;
                event.preventDefault();
                setDragOverStatus(column.status);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(event) => handleBoardDrop(column.status, event)}
              className={cn(
                "min-h-[320px] rounded-2xl border border-border bg-surface-alt/20 p-3 transition",
                dragOverStatus === column.status && "border-primary bg-primary/5 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {BOARD_STATUS_LABELS[column.status]}
                  </p>
                  <p className="font-financial text-2xl font-semibold">{column.items.length}</p>
                </div>
                <Badge
                  variant={
                    column.status === "Cancelled"
                      ? "danger"
                      : column.status === "PartiallyDispatched"
                        ? "warning"
                        : column.status === "Ready"
                          ? "success"
                          : "outline"
                  }
                >
                  {BOARD_STATUS_LABELS[column.status]}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                  {column.items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-background/60 px-3 py-4 text-sm text-muted-foreground">
                      Drop a load here.
                    </p>
                  ) : (
                  column.items.map((pass) => (
                    <div
                      key={pass.id}
                      draggable={canFulfil && pass.status !== "Dispatched" && pass.status !== "Cancelled"}
                      onDragStart={(event) => {
                        setDraggedPassId(pass.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", pass.id);
                      }}
                      onDragEnd={() => {
                        setDraggedPassId(null);
                        setDragOverStatus(null);
                      }}
                      className={cn(
                        "rounded-xl border border-border bg-card p-3 shadow-sm transition",
                        draggedPassId === pass.id && "opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-medium">{pass.gatePassNo}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pass.customerName ?? "No customer"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pass.containerNo ?? "Mixed lot"}
                            {pass.salesOrderNo ? ` - ${pass.salesOrderNo}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pass.nextFefoDate ? `FEFO ${formatDate(pass.nextFefoDate)}` : formatDate(pass.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              pass.status === "Cancelled"
                                ? "danger"
                                : pass.status === "PartiallyDispatched"
                                  ? "warning"
                                  : pass.status === "Ready"
                                    ? "success"
                                    : "outline"
                            }
                          >
                            {pass.status}
                          </Badge>
                          <p className="mt-1 font-financial text-sm">
                            {prettyQty(pass.dispatchedQty)} / {prettyQty(pass.totalQty)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg border border-border bg-surface-alt/40 p-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Fleet:{" "}
                            <span className="font-medium text-foreground">
                              {pass.vehicleNo && pass.driverName
                                ? `${pass.vehicleNo} / ${pass.driverName}`
                                : "Not logged"}
                            </span>
                          </span>
                          {canFulfil ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openFleetDialog(pass)}
                              disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                            >
                              {pass.vehicleNo ? "Update fleet" : "Log fleet"}
                            </Button>
                          ) : null}
                        </div>
                        {pass.driverContact ? (
                          <p className="mt-1">Driver contact: {pass.driverContact}</p>
                        ) : null}
                        <div className="mt-2 grid gap-1 sm:grid-cols-2">
                          <span>Seal: {pass.vehicleSealNo ?? "Pending"}</span>
                          <span>OTP: {pass.securityOtp ? "Issued" : "Pending"}</span>
                          <span>Gate: {pass.securityGateOutAt ? formatDate(pass.securityGateOutAt) : "Not cleared"}</span>
                          <span>POD: {pass.podRef ? "Received" : "Pending"}</span>
                        </div>
                        {pass.routeName || pass.beatName ? (
                          <p className="mt-1">
                            Route: {pass.routeName ?? "Unplanned"} / {pass.beatName ?? "No beat"}
                          </p>
                        ) : null}
                        {canFulfil ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openGateDialog(pass)}
                              disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                            >
                              Security gate
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openPodDialog(pass)}
                              disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                            >
                              POD / returns
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {showStockWorkspace ? (
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Container / Lot</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>UoM</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>FEFO / Age</TableHead>
              <TableHead>Cold Chain</TableHead>
              {canAdjust && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canAdjust ? 8 : 7}
                  className="h-44 text-center text-muted-foreground"
                >
                  <EmptyState
                    icon={PackageOpen}
                    title="No stock on hand"
                    description="Receive a cleared container into the warehouse to create the first live lot."
                    className="border-0 bg-transparent py-6"
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => void loadMovementHistory(row.id)}
                  className={cn(
                    "cursor-pointer",
                    selectedStockItemId === row.id && "bg-primary/5",
                    row.expiryBand === "expired" && "bg-danger/5",
                    row.expiryBand === "critical" && "bg-warning/10"
                  )}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{row.containerNo}</p>
                      <p className="font-financial text-xs text-muted-foreground">
                        {row.blNo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lot {row.lotNo ?? "-"} {row.palletNo ? `- Pallet ${row.palletNo}` : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{row.warehouseName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.warehouseCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.locationCode
                          ? `${row.locationCode} - ${row.locationName ?? "Storage location"}`
                          : "No bin assigned"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{row.item}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.variety ?? "-"} {row.grade ? `- Grade ${row.grade}` : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-financial">{row.uom}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-financial text-sm font-semibold">
                        Avail {prettyQty(row.qtyAvailable)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Res {prettyQty(row.qtyReserved)} - Sold {prettyQty(row.qtySold)} -
                        Waste {prettyQty(row.qtyWastage)} - Dump {prettyQty(row.qtyDump)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={toneForBand(row.expiryBand)}>FEFO</Badge>
                        <span className="text-sm">
                          {row.expiryDate
                            ? formatDate(row.expiryDate)
                            : row.bestBeforeDate
                              ? formatDate(row.bestBeforeDate)
                              : "No expiry"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Age {row.ageDays == null ? "-" : `${row.ageDays}d`}
                        {row.fefoDueInDays != null
                          ? ` - ${row.fefoDueInDays < 0 ? `${Math.abs(row.fefoDueInDays)}d overdue` : `${row.fefoDueInDays}d left`}`
                          : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant={
                            row.qualityStatus === "Released"
                              ? "success"
                              : row.qualityStatus === "Rejected"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {row.qualityStatus}
                        </Badge>
                        {row.temperatureBreach ? <Badge variant="danger">Temp breach</Badge> : null}
                      </div>
                      <p>{row.storageCondition ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.temperatureAtReceiptC == null
                          ? "No receipt temperature"
                          : `${row.temperatureAtReceiptC} C at receipt`}
                        {row.ripeningState ? ` | ${row.ripeningState}` : ""}
                      </p>
                    </div>
                  </TableCell>
                  {canAdjust && (
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <ActionButton
                          label="Grade"
                          icon={PackageOpen}
                          onClick={() => openGradeDialog(row)}
                          busy={actionBusyId === row.id}
                        />
                        <ActionButton
                          label="Quality"
                          icon={ShieldAlert}
                          onClick={() => openQualityDialog(row)}
                          busy={actionBusyId === row.id}
                        />
                        <ActionButton
                          label="Move"
                          icon={PackageOpen}
                          onClick={() => openTransferDialog(row)}
                          busy={actionBusyId === row.id}
                        />
                        {canFulfil && (
                          <ActionButton
                            label="Gate Pass"
                            icon={Truck}
                            onClick={() =>
                              row.qualityStatus === "Released"
                                ? openDispatchDialog(row)
                                : toast.error("Release the lot from quality hold before dispatch")
                            }
                            busy={actionBusyId === row.id}
                          />
                        )}
                        <ActionButton
                          label="Reserve"
                          icon={RotateCw}
                          onClick={() => openStockActionDialog(row, "reserve")}
                          busy={actionBusyId === row.id}
                        />
                        <ActionButton
                          label="Release"
                          icon={RotateCcw}
                          onClick={() => openStockActionDialog(row, "release")}
                          busy={actionBusyId === row.id}
                        />
                        <ActionButton
                          label="Waste"
                          icon={Scissors}
                          onClick={() => openStockActionDialog(row, "wastage")}
                          busy={actionBusyId === row.id}
                        />
                        <ActionButton
                          label="Dump"
                          icon={Trash2}
                          onClick={() => openStockActionDialog(row, "dump")}
                          busy={actionBusyId === row.id}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      ) : null}

      {showStockWorkspace ? (
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label-caps">Movement History</p>
              <h3 className="font-heading text-lg font-semibold">Stock trail</h3>
            </div>
            {selectedStock ? (
              <div className="text-right">
                <p className="text-sm font-medium">{selectedStock.item}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStock.containerNo} - {selectedStock.blNo}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            {!selectedStock ? (
              <EmptyState
                icon={PackageOpen}
                title="Select a stock lot"
                description="Click any stock row above to review its receipts, grading, wastage, reserves, and dispatch history."
                className="border-0 bg-transparent py-8"
              />
            ) : movementBusy ? (
              <div className="flex min-h-[180px] items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : movementRows.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title="No movements yet"
                description="This lot has no recorded movements."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <div className="space-y-3">
                {movementRows.map((movement) => (
                  <div key={movement.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{movement.kind}</Badge>
                          <span className="font-financial font-semibold">
                            {prettyQty(movement.qty)} {movement.uom}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {movement.reason ?? "No note supplied"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {movement.refType && movement.refId
                            ? `Ref: ${movement.refType} / ${movement.refId}`
                            : "No linked reference"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{formatDate(movement.createdAt)}</p>
                        <p>
                          {movement.createdBy?.fullName ?? movement.createdBy?.email ?? "System"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="label-caps">Lot Snapshot</p>
          {selectedStock ? (
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Container</p>
                <p className="font-medium">{selectedStock.containerNo}</p>
                <p className="font-financial text-xs text-muted-foreground">{selectedStock.blNo}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Lot</p>
                <p className="font-medium">
                  {selectedStock.lotNo ?? "No lot"} {selectedStock.palletNo ? `- ${selectedStock.palletNo}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedStock.item} {selectedStock.variety ? `- ${selectedStock.variety}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-alt/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Available</p>
                  <p className="mt-1 font-financial text-lg font-semibold">
                    {prettyQty(selectedStock.qtyAvailable)}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-alt/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Reserved</p>
                  <p className="mt-1 font-financial text-lg font-semibold">
                    {prettyQty(selectedStock.qtyReserved)}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-alt/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sold</p>
                  <p className="mt-1 font-financial text-lg font-semibold">
                    {prettyQty(selectedStock.qtySold)}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-alt/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Waste / Dump</p>
                  <p className="mt-1 font-financial text-lg font-semibold">
                    {prettyQty(selectedStock.qtyWastage + selectedStock.qtyDump)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={PackageOpen}
              title="No lot selected"
              description="Use the stock table to inspect a lot's live balance and its movement trail."
              className="border-0 bg-transparent py-8"
            />
          )}
        </div>
      </div>
      ) : null}

      <Dialog
        open={presetDialog.open}
        onOpenChange={(open) => setPresetDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {presetDialog.mode === "rename" ? "Rename board preset" : "Save board preset"}
            </DialogTitle>
            <DialogDescription>
              Save the current search, filter, and visible fulfilment columns for this browser.
            </DialogDescription>
          </DialogHeader>
          <Field label="Preset name">
            <Input
              value={presetDialog.name}
              onChange={(event) =>
                setPresetDialog((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Morning dispatch view"
            />
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPresetDialog((current) => ({ ...current, open: false }))}
            >
              Cancel
            </Button>
            <Button onClick={submitBoardPresetDialog}>
              {presetDialog.mode === "rename" ? "Rename preset" : "Save preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePresetOpen} onOpenChange={setDeletePresetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete board preset</DialogTitle>
            <DialogDescription>
              {activeBoardPreset
                ? `Delete "${activeBoardPreset.name}" from this browser?`
                : "No preset is currently selected."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePresetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteBoardPreset} disabled={!activeBoardPreset}>
              Delete preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={stockActionDialog.open}
        onOpenChange={(open) => setStockActionDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{STOCK_ACTION_LABELS[stockActionDialog.action]}</DialogTitle>
            <DialogDescription>
              {stockActionTarget
                ? `${stockActionTarget.containerNo} / ${stockActionTarget.item} - available ${prettyQty(stockActionTarget.qtyAvailable)} ${stockActionTarget.uom}`
                : "Choose a stock lot before running this action."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Quantity">
              <Input
                type="number"
                min="0"
                step="0.001"
                value={stockActionDialog.qty}
                onChange={(event) =>
                  setStockActionDialog((current) => ({ ...current, qty: event.target.value }))
                }
              />
            </Field>
            {stockActionDialog.action === "adjust" ? (
              <Field label="Direction">
                <Select
                  value={stockActionDialog.direction}
                  onValueChange={(direction) =>
                    setStockActionDialog((current) => ({
                      ...current,
                      direction: direction as StockActionDialogState["direction"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase stock</SelectItem>
                    <SelectItem value="decrease">Decrease stock</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <Field label="Reason / note">
              <Input
                value={stockActionDialog.reason}
                onChange={(event) =>
                  setStockActionDialog((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="Manager approval, repack variance, customer reserve..."
              />
            </Field>
            {["wastage", "dump"].includes(stockActionDialog.action) ? (
              <Field label="Evidence / inspection ref">
                <Input
                  value={stockActionDialog.evidenceRef}
                  onChange={(event) =>
                    setStockActionDialog((current) => ({
                      ...current,
                      evidenceRef: event.target.value,
                    }))
                  }
                  placeholder="Photo ref, QC sheet, return note, or supervisor approval"
                />
              </Field>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStockActionDialog((current) => ({ ...current, open: false }))}
              disabled={Boolean(actionBusyId)}
            >
              Cancel
            </Button>
            <Button onClick={submitStockAction} disabled={Boolean(actionBusyId)}>
              {actionBusyId && <Loader2 className="h-4 w-4 animate-spin" />}
              Save action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={qualityDialog.open}
        onOpenChange={(open) => setQualityDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Quality decision</DialogTitle>
            <DialogDescription>
              {qualityTarget
                ? `${qualityTarget.containerNo} / ${qualityTarget.item} - current ${qualityTarget.qualityStatus}`
                : "Choose a stock lot before changing quality status."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Quality status">
              <Select
                value={qualityDialog.qualityStatus}
                onValueChange={(qualityStatus) =>
                  setQualityDialog((current) => ({
                    ...current,
                    qualityStatus: qualityStatus as QualityDialogState["qualityStatus"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Released", "QualityHold", "Quarantine", "Rejected"].map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Decision reason">
              <Input
                value={qualityDialog.reason}
                onChange={(event) =>
                  setQualityDialog((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="QC result, temperature exception, supervisor release..."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQualityDialog((current) => ({ ...current, open: false }))}
              disabled={Boolean(actionBusyId)}
            >
              Cancel
            </Button>
            <Button onClick={submitQualityAction} disabled={Boolean(actionBusyId)}>
              {actionBusyId && <Loader2 className="h-4 w-4 animate-spin" />}
              Save quality status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferDialog.open}
        onOpenChange={(open) => setTransferDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Move lot location</DialogTitle>
            <DialogDescription>
              {transferTarget
                ? `${transferTarget.containerNo} / ${transferTarget.item} - from ${transferTarget.locationCode ?? "unassigned"}`
                : "Choose a stock lot before moving it."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Destination location">
              <Select
                value={transferDialog.locationId}
                onValueChange={(locationId) =>
                  setTransferDialog((current) => ({ ...current, locationId }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination bin" />
                </SelectTrigger>
                <SelectContent>
                  {transferLocations.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No alternate active locations
                    </SelectItem>
                  ) : (
                    transferLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.code} - {location.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Transfer reason">
              <Input
                value={transferDialog.reason}
                onChange={(event) =>
                  setTransferDialog((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="Directed putaway, FEFO staging, room transfer..."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialog((current) => ({ ...current, open: false }))}
              disabled={Boolean(actionBusyId)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitTransferAction}
              disabled={Boolean(actionBusyId) || transferLocations.length === 0}
            >
              {actionBusyId && <Loader2 className="h-4 w-4 animate-spin" />}
              Move lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationOpen} onOpenChange={setLocationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create warehouse location</DialogTitle>
            <DialogDescription>
              Build the room, zone, bin, dock, or staging hierarchy used for directed putaway and picking.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Warehouse">
              <Select value={locationForm.warehouseId} onValueChange={(warehouseId) => setLocationForm({ ...locationForm, warehouseId, parentId: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Parent location">
              <Select value={locationForm.parentId || "none"} onValueChange={(parentId) => setLocationForm({ ...locationForm, parentId: parentId === "none" ? "" : parentId })}>
                <SelectTrigger><SelectValue placeholder="Top level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Top level</SelectItem>
                  {locations.filter((location) => location.warehouseId === locationForm.warehouseId).map((location) => <SelectItem key={location.id} value={location.id}>{location.code} - {location.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Code"><Input value={locationForm.code} onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })} placeholder="CR1-ZA-B01" /></Field>
            <Field label="Name"><Input value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} placeholder="Cold Room 1 / Zone A / Bin 01" /></Field>
            <Field label="Type">
              <Select value={locationForm.type} onValueChange={(type) => setLocationForm({ ...locationForm, type: type as WarehouseLocationOption["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Room", "Zone", "Bin", "Dock", "Staging"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Capacity units"><Input type="number" min="0" step="0.001" value={locationForm.capacityUnits} onChange={(e) => setLocationForm({ ...locationForm, capacityUnits: e.target.value })} /></Field>
            <Field label="Minimum C"><Input type="number" step="0.1" value={locationForm.temperatureMinC} onChange={(e) => setLocationForm({ ...locationForm, temperatureMinC: e.target.value })} /></Field>
            <Field label="Maximum C"><Input type="number" step="0.1" value={locationForm.temperatureMaxC} onChange={(e) => setLocationForm({ ...locationForm, temperatureMaxC: e.target.value })} /></Field>
            <Field label="Notes"><Input value={locationForm.notes} onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={createLocation} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive container into warehouse stock</DialogTitle>
            <DialogDescription>
              Create one or more stock lots from a cleared container. The system will
              write a stock movement for every line so the traceability remains intact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Container">
                <Select value={selectedContainerId} onValueChange={handleContainerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a container" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No containers ready for stock receiving
                      </SelectItem>
                    ) : (
                      containers.map((container) => (
                        <SelectItem key={container.id} value={container.id}>
                          {container.containerNo} / {container.blNo} - {container.warehouse?.name ?? "Warehouse"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <div className="rounded-2xl border border-border bg-surface-alt/40 p-4">
                <p className="label-caps">Selected Container</p>
                {selectedContainer ? (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="font-medium">
                      {selectedContainer.containerNo} - {selectedContainer.blNo}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedContainer.warehouse?.name ?? "No warehouse"}{" "}
                      {selectedContainer.warehouse?.code ? `(${selectedContainer.warehouse.code})` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedContainer.item ?? "No item"}{" "}
                      {selectedContainer.variety ? `- ${selectedContainer.variety}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Choose the container that has just been cleared into the cold store.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-surface-alt/30 p-4 md:grid-cols-3">
              <div>
                <p className="label-caps">Receive Total</p>
                <p className="mt-1 font-financial text-lg font-semibold">
                  {prettyQty(receiveTotal)}
                </p>
              </div>
              <div>
                <p className="label-caps">Container Boxes</p>
                <p className="mt-1 font-financial text-lg font-semibold">
                  {selectedContainer?.noOfBoxes != null ? prettyQty(selectedContainer.noOfBoxes) : "-"}
                </p>
              </div>
              <div>
                <p className="label-caps">Receiving Note</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prefer Box / Kg entries for cold-store intake. Add extra lines only when the lot is split at receipt.
                </p>
              </div>
            </div>

            {rows.map((row, index) => (
              <div key={index} className="rounded-2xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Lot line {index + 1}</p>
                    <p className="text-xs text-muted-foreground">
                      Each row becomes a live stock lot with its own FEFO and traceability.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <Field label="Item">
                    <Input
                      value={row.item}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, item: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Variety">
                    <Input
                      value={row.variety}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, variety: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Grade">
                    <Input
                      value={row.grade}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, grade: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="UoM">
                    <Select
                      value={row.uom}
                      onValueChange={(value) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, uom: value as ReceiveRowState["uom"] }
                              : entry
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UOM_OPTIONS.map((uom) => (
                          <SelectItem key={uom} value={uom}>
                            {uom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Location">
                    <Select
                      value={row.locationId || "__none__"}
                      onValueChange={(value) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, locationId: value === "__none__" ? "" : value }
                              : entry
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional storage location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No location</SelectItem>
                        {warehouseLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.code} - {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Qty Received">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.qtyReceived}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, qtyReceived: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Per-unit Kg">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.perUnitWeightKg}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, perUnitWeightKg: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <Field label="Lot No">
                    <Input
                      value={row.lotNo}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, lotNo: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Pallet No">
                    <Input
                      value={row.palletNo}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, palletNo: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Pack Date">
                    <Input
                      type="date"
                      value={row.packDate}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, packDate: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Expiry Date">
                    <Input
                      type="date"
                      value={row.expiryDate}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, expiryDate: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Best Before">
                    <Input
                      type="date"
                      value={row.bestBeforeDate}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, bestBeforeDate: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Cold Chain State">
                    <Input
                      value={row.storageCondition}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, storageCondition: e.target.value }
                              : entry
                          )
                        )
                      }
                      placeholder="2-4C / 0-2C / ambient"
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Ripening State">
                    <Input
                      value={row.ripeningState}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, ripeningState: e.target.value }
                              : entry
                          )
                        )
                      }
                      placeholder="Green / Ripening / Ready"
                    />
                  </Field>
                  <Field label="Receipt Temperature C">
                    <Input
                      type="number"
                      step="0.1"
                      value={row.temperatureAtReceiptC}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, temperatureAtReceiptC: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Quality State">
                    <Select
                      value={row.temperatureBreach ? "Quarantine" : row.qualityStatus}
                      onValueChange={(value) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, qualityStatus: value as ReceiveRowState["qualityStatus"] }
                              : entry
                          )
                        )
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Released">Released</SelectItem>
                        <SelectItem value="QualityHold">Quality Hold</SelectItem>
                        <SelectItem value="Quarantine">Quarantine</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.temperatureBreach}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, temperatureBreach: e.target.checked } : entry
                          )
                        )
                      }
                    />
                    Temperature breach
                  </label>
                  <Field label="Hold / Breach Reason">
                    <Input
                      value={row.qualityHoldReason}
                      onChange={(e) =>
                        setRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, qualityHoldReason: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add Another Lot
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReceiveOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={submitReceipt} disabled={saving || !selectedContainerId}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Receive Stock
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grade and split stock lot</DialogTitle>
            <DialogDescription>
              Split a raw or ungraded lot into sellable grades, ripening states, or reject lines.
              The source lot stays traceable and the child lots inherit its warehouse trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface-alt/40 p-4">
              <p className="label-caps">Source Lot</p>
              {gradeSource ? (
                <div className="mt-2 grid gap-1 text-sm md:grid-cols-3">
                  <p className="font-medium">{gradeSource.containerNo}</p>
                  <p className="font-financial">{gradeSource.blNo}</p>
                  <p className="text-muted-foreground">
                    Avail {prettyQty(gradeSource.qtyAvailable)} {gradeSource.uom}
                  </p>
                  <p className="text-muted-foreground">
                    {gradeSource.item} {gradeSource.variety ? `- ${gradeSource.variety}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Lot {gradeSource.lotNo ?? "-"} {gradeSource.palletNo ? `- Pallet ${gradeSource.palletNo}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    FEFO {gradeSource.expiryDate ? formatDate(gradeSource.expiryDate) : "No expiry"}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No source lot selected.</p>
              )}
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-surface-alt/30 p-4 md:grid-cols-3">
              <div>
                <p className="label-caps">Split Total</p>
                <p className="mt-1 font-financial text-lg font-semibold">
                  {prettyQty(gradeTotal)}
                </p>
              </div>
              <div>
                <p className="label-caps">Available</p>
                <p className="mt-1 font-financial text-lg font-semibold">
                  {prettyQty(gradeSource?.qtyAvailable ?? 0)}
                </p>
              </div>
              <div>
                <p className="label-caps">Left after split</p>
                <p className="mt-1 font-financial text-lg font-semibold">
                  {prettyQty(Math.max((gradeSource?.qtyAvailable ?? 0) - gradeTotal, 0))}
                </p>
              </div>
            </div>

            <Field label="Grading note">
              <Input
                value={gradeReason}
                onChange={(e) => setGradeReason(e.target.value)}
                placeholder="Manual grading after quality check / ripening review"
              />
            </Field>

            {gradeRows.map((row, index) => (
              <div key={index} className="rounded-2xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Grade line {index + 1}</p>
                    <p className="text-xs text-muted-foreground">
                      Split quantity creates a new child lot with its own grade and FEFO date.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGradeRow(index)}
                    disabled={gradeRows.length === 1}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <Field label="Item">
                    <Input
                      value={row.item}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, item: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Variety">
                    <Input
                      value={row.variety}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, variety: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Grade">
                    <Input
                      value={row.grade}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, grade: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="UoM">
                    <Select
                      value={row.uom}
                      onValueChange={(value) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, uom: value as ReceiveRowState["uom"] }
                              : entry
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UOM_OPTIONS.map((uom) => (
                          <SelectItem key={uom} value={uom}>
                            {uom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Qty Split">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.qtyReceived}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, qtyReceived: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Per-unit Kg">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.perUnitWeightKg}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, perUnitWeightKg: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <Field label="Lot No">
                    <Input
                      value={row.lotNo}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, lotNo: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Pallet No">
                    <Input
                      value={row.palletNo}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, palletNo: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Pack Date">
                    <Input
                      type="date"
                      value={row.packDate}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, packDate: e.target.value } : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Expiry Date">
                    <Input
                      type="date"
                      value={row.expiryDate}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, expiryDate: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Best Before">
                    <Input
                      type="date"
                      value={row.bestBeforeDate}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, bestBeforeDate: e.target.value }
                              : entry
                          )
                        )
                      }
                    />
                  </Field>
                  <Field label="Cold Chain State">
                    <Input
                      value={row.storageCondition}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, storageCondition: e.target.value }
                              : entry
                          )
                        )
                      }
                      placeholder="0-2C ripening room / 2-4C / ambient"
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Ripening State">
                    <Input
                      value={row.ripeningState}
                      onChange={(e) =>
                        setGradeRows((current) =>
                          current.map((entry, i) =>
                            i === index
                              ? { ...entry, ripeningState: e.target.value }
                              : entry
                          )
                        )
                      }
                      placeholder="Green / Ripening / Ready / Reject"
                    />
                  </Field>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={addGradeRow}>
                <Plus className="h-4 w-4" /> Add Grade Line
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGradeOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={submitGrade} disabled={saving || !gradeSourceId}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Apply Grade Split
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create gate pass</DialogTitle>
            <DialogDescription>
              Reserve a load from stock, assign the transport details, and move it into
              the fulfilment board.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface-alt/40 p-4">
              <p className="label-caps">Source Lot</p>
              {dispatchSource ? (
                <div className="mt-2 grid gap-1 text-sm md:grid-cols-3">
                  <p className="font-medium">{dispatchSource.containerNo}</p>
                  <p className="font-financial">{dispatchSource.blNo}</p>
                  <p className="text-muted-foreground">
                    Avail {prettyQty(dispatchSource.qtyAvailable)} {dispatchSource.uom}
                  </p>
                  <p className="text-muted-foreground">
                    {dispatchSource.item} {dispatchSource.variety ? `- ${dispatchSource.variety}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Lot {dispatchSource.lotNo ?? "-"} {dispatchSource.palletNo ? `- Pallet ${dispatchSource.palletNo}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Warehouse {dispatchSource.warehouseName}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No source lot selected.</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Dispatch Qty">
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(e.target.value)}
                />
              </Field>
              <Field label="Vehicle No">
                <Input
                  value={dispatchVehicleNo}
                  onChange={(e) => setDispatchVehicleNo(e.target.value)}
                  placeholder="KL-07-AB-1234"
                />
              </Field>
              <Field label="Driver Name">
                <Input
                  value={dispatchDriverName}
                  onChange={(e) => setDispatchDriverName(e.target.value)}
                  placeholder="Driver name"
                />
              </Field>
              <Field label="Driver Contact">
                <Input
                  value={dispatchDriverContact}
                  onChange={(e) => setDispatchDriverContact(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Notes">
                <Input
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="Packed for customer / branch / export run"
                />
              </Field>
              <Field label="Exception reason">
                <Input
                  value={dispatchExceptionReason}
                  onChange={(e) => setDispatchExceptionReason(e.target.value)}
                  placeholder="Why this load is not linked to an approved sales order"
                />
              </Field>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDispatchOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={submitDispatch} disabled={saving || !dispatchSourceId}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Gate Pass
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fleetDialog.open}
        onOpenChange={(open) =>
          setFleetDialog((current) => ({
            ...current,
            open,
          }))
        }
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log fleet details</DialogTitle>
            <DialogDescription>
              Capture the vehicle and driver handoff once the warehouse load is ready
              for outward dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {fleetGatePass ? (
              <div className="rounded-2xl border border-border bg-surface-alt/40 p-4 text-sm">
                <p className="label-caps">Gate pass</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <p className="font-medium">{fleetGatePass.gatePassNo}</p>
                  <p className="text-muted-foreground">
                    {fleetGatePass.customerName ?? "No customer"}
                  </p>
                  <p className="text-muted-foreground">
                    {fleetGatePass.containerNo ?? "Mixed lot"}
                  </p>
                  <p className="text-muted-foreground">
                    OTP {fleetGatePass.securityOtp ?? "will be issued on save"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Vehicle No">
                <Input
                  value={fleetDialog.vehicleNo}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      vehicleNo: e.target.value,
                    }))
                  }
                  placeholder="KL-07-AB-1234"
                />
              </Field>
              <Field label="Driver Name">
                <Input
                  value={fleetDialog.driverName}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      driverName: e.target.value,
                    }))
                  }
                  placeholder="Driver name"
                />
              </Field>
              <Field label="Driver Contact">
                <Input
                  value={fleetDialog.driverContact}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      driverContact: e.target.value,
                    }))
                  }
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Vehicle Seal No">
                <Input
                  value={fleetDialog.vehicleSealNo}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      vehicleSealNo: e.target.value,
                    }))
                  }
                  placeholder="Seal number after loading"
                />
              </Field>
              <Field label="Loading Photo / Proof Ref">
                <Input
                  value={fleetDialog.loadingPhotoRef}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      loadingPhotoRef: e.target.value,
                    }))
                  }
                  placeholder="Photo URL, document ref, or storage path"
                />
              </Field>
              <Field label="Upload Loading Photo / POD Prep">
                <Input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      loadingPhotoFile: e.target.files?.[0] ?? null,
                    }))
                  }
                />
                {fleetDialog.loadingPhotoFile ? (
                  <p className="text-xs text-muted-foreground">
                    {fleetDialog.loadingPhotoFile.name} - {formatBytes(fleetDialog.loadingPhotoFile.size)}
                  </p>
                ) : null}
              </Field>
              <Field label="Route">
                <Input
                  value={fleetDialog.routeName}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      routeName: e.target.value,
                    }))
                  }
                  placeholder="Kochi city / Aluva / Thrissur"
                />
              </Field>
              <Field label="Beat">
                <Input
                  value={fleetDialog.beatName}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      beatName: e.target.value,
                    }))
                  }
                  placeholder="Morning beat / Modern retail run"
                />
              </Field>
              <Field label="Customer Delivery Instructions">
                <Input
                  value={fleetDialog.deliveryInstructions}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      deliveryInstructions: e.target.value,
                    }))
                  }
                  placeholder="Receiving hours, dock, contact, unload rule"
                />
              </Field>
              <Field label="Return Crates Planned">
                <Input
                  type="number"
                  min="0"
                  value={fleetDialog.returnCratesPlanned}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      returnCratesPlanned: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Return Pallets Planned">
                <Input
                  type="number"
                  min="0"
                  value={fleetDialog.returnPalletsPlanned}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      returnPalletsPlanned: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Dispatch Notes">
                <Input
                  value={fleetDialog.notes}
                  onChange={(e) =>
                    setFleetDialog((current) => ({
                      ...current,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Vehicle seal, route, dock, or customer instruction"
                />
              </Field>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFleetDialog((current) => ({ ...current, open: false }))}
              >
                Cancel
              </Button>
              <Button
                onClick={submitFleetDetails}
                disabled={actionBusyId === fleetDialog.gatePassId}
              >
                {actionBusyId === fleetDialog.gatePassId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Fleet Details
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={gateDialog.open}
        onOpenChange={(open) => setGateDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Security gate exit confirmation</DialogTitle>
            <DialogDescription>
              Security confirms the vehicle only after seal/proof are logged and the driver OTP matches.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {gateTarget ? (
              <div className="rounded-2xl border border-border bg-surface-alt/40 p-4 text-sm">
                <p className="label-caps">Gate pass</p>
                <p className="mt-2 font-medium">{gateTarget.gatePassNo}</p>
                <p className="text-muted-foreground">
                  Vehicle {gateTarget.vehicleNo ?? "not logged"} - Seal {gateTarget.vehicleSealNo ?? "not logged"}
                </p>
                <p className="text-muted-foreground">
                  Loading proof {gateTarget.loadingPhotoRef ?? "not logged"}
                </p>
                <p className="mt-2 rounded-xl border border-border bg-card px-3 py-2 font-financial text-lg">
                  Driver OTP: {gateTarget.securityOtp ?? "Save fleet details to issue OTP"}
                </p>
              </div>
            ) : null}
            <Field label="OTP entered by driver / security">
              <Input
                value={gateDialog.securityOtp}
                onChange={(e) =>
                  setGateDialog((current) => ({
                    ...current,
                    securityOtp: e.target.value,
                  }))
                }
                placeholder="6-digit OTP"
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGateDialog((current) => ({ ...current, open: false }))}
              >
                Cancel
              </Button>
              <Button
                onClick={submitGateExit}
                disabled={actionBusyId === gateDialog.gatePassId}
              >
                {actionBusyId === gateDialog.gatePassId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Confirm Gate Exit
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={podDialog.open}
        onOpenChange={(open) => setPodDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>POD, customer acknowledgement, and returns</DialogTitle>
            <DialogDescription>
              Close the delivery loop with proof of delivery and return crate/pallet reconciliation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {podTarget ? (
              <div className="rounded-2xl border border-border bg-surface-alt/40 p-4 text-sm">
                <p className="label-caps">Delivery</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <p className="font-medium">{podTarget.gatePassNo}</p>
                  <p className="text-muted-foreground">{podTarget.routeName ?? "No route"}</p>
                  <p className="text-muted-foreground">{podTarget.beatName ?? "No beat"}</p>
                </div>
                {podTarget.deliveryInstructions ? (
                  <p className="mt-2 text-muted-foreground">
                    Instructions: {podTarget.deliveryInstructions}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="POD Reference / Upload Ref">
                <Input
                  value={podDialog.podRef}
                  onChange={(e) =>
                    setPodDialog((current) => ({
                      ...current,
                      podRef: e.target.value,
                    }))
                  }
                  placeholder="Signed POD URL, document ref, or photo path"
                />
              </Field>
              <Field label="Upload POD">
                <Input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(e) =>
                    setPodDialog((current) => ({
                      ...current,
                      podFile: e.target.files?.[0] ?? null,
                    }))
                  }
                />
                {podDialog.podFile ? (
                  <p className="text-xs text-muted-foreground">
                    {podDialog.podFile.name} - {formatBytes(podDialog.podFile.size)}
                  </p>
                ) : null}
              </Field>
              <Field label="Customer Acknowledged By">
                <Input
                  value={podDialog.podAcknowledgedBy}
                  onChange={(e) =>
                    setPodDialog((current) => ({
                      ...current,
                      podAcknowledgedBy: e.target.value,
                    }))
                  }
                  placeholder="Receiver name / phone"
                />
              </Field>
              <Field label="Return Crates Received">
                <Input
                  type="number"
                  min="0"
                  value={podDialog.returnCratesReceived}
                  onChange={(e) =>
                    setPodDialog((current) => ({
                      ...current,
                      returnCratesReceived: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Return Pallets Received">
                <Input
                  type="number"
                  min="0"
                  value={podDialog.returnPalletsReceived}
                  onChange={(e) =>
                    setPodDialog((current) => ({
                      ...current,
                      returnPalletsReceived: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPodDialog((current) => ({ ...current, open: false }))}
              >
                Cancel
              </Button>
              <Button
                onClick={submitPodAndReturns}
                disabled={actionBusyId === podDialog.gatePassId}
              >
                {actionBusyId === podDialog.gatePassId && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save POD / Returns
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="label-caps">Fulfilment Board</p>
            <h3 className="font-heading text-lg font-semibold">Gate passes and dispatch</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-surface-alt px-2.5 py-1">
              Picked to Packed to Ready to Dispatch
            </span>
          </div>
        </div>

        {gatePasses.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No gate passes yet"
            description="Create a gate pass from a stock lot when a load is being prepared for dispatch."
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Gate Pass</TableHead>
                  <TableHead>Load</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  {canFulfil && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gatePasses.map((pass) => (
                  <TableRow key={pass.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{pass.gatePassNo}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(pass.createdAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {pass.containerNo ?? "Mixed lot"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pass.blNo ?? "-"} - {pass.warehouseName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-financial">
                      {prettyQty(pass.dispatchedQty)} / {prettyQty(pass.totalQty)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          pass.status === "Dispatched"
                            ? "success"
                            : pass.status === "PartiallyDispatched"
                              ? "warning"
                              : pass.status === "Cancelled"
                                ? "danger"
                                : "outline"
                        }
                      >
                        {pass.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{pass.vehicleNo ?? "-"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{pass.driverName ?? "-"}</p>
                        {pass.driverContact ? (
                          <p className="text-xs text-muted-foreground">{pass.driverContact}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    {canFulfil && (
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openFleetDialog(pass)}
                            disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                          >
                            Fleet
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openGateDialog(pass)}
                            disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                          >
                            Gate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPodDialog(pass)}
                            disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                          >
                            POD
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runGatePassAction(pass.id, "pack")}
                            disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                          >
                            Pack
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runGatePassAction(pass.id, "ready")}
                            disabled={actionBusyId === pass.id || pass.status === "Cancelled"}
                          >
                            Ready
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runGatePassAction(pass.id, "dispatch")}
                            disabled={
                              actionBusyId === pass.id ||
                              pass.status === "Cancelled" ||
                              !pass.vehicleNo ||
                              !pass.driverName
                            }
                          >
                            Dispatch
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => runGatePassAction(pass.id, "cancel")}
                            disabled={actionBusyId === pass.id || pass.status === "Dispatched"}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClasses =
    tone === "danger"
      ? "border-danger/20 bg-danger/5 text-danger"
      : tone === "warning"
        ? "border-warning/20 bg-warning/10 text-[#9A6212]"
        : tone === "success"
          ? "border-success/20 bg-success/10 text-success"
          : "border-border bg-card";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", toneClasses)}>
      <p className="label-caps">{label}</p>
      <p className="mt-2 font-financial text-2xl font-semibold">{value}</p>
    </div>
  );
}

function WarehouseProcessStory({
  viewMode,
}: {
  viewMode: "stock" | "inward" | "processing" | "dispatch";
}) {
  const steps = [
    {
      title: "GRN",
      owner: "Receiver",
      kpi: "container -> lot",
      active: viewMode === "inward",
    },
    {
      title: "QC / Grade",
      owner: "Supervisor",
      kpi: "hold -> release",
      active: viewMode === "processing" || viewMode === "stock",
    },
    {
      title: "Store / Count",
      owner: "Storekeeper",
      kpi: "bin accuracy",
      active: viewMode === "processing" || viewMode === "stock",
    },
    {
      title: "Pick / Pack",
      owner: "Packing",
      kpi: "order match",
      active: viewMode === "dispatch",
    },
    {
      title: "Fleet / Gate",
      owner: "Billing + security",
      kpi: "OTP clear",
      active: viewMode === "dispatch",
    },
    {
      title: "POD / Returns",
      owner: "Driver + collections",
      kpi: "asset close",
      active: viewMode === "dispatch",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm">
      <div className="grid gap-5 p-5 lg:grid-cols-[0.45fr_1.55fr]">
        <div>
          <p className="label-caps">Active lane</p>
          <h2 className="mt-2 font-heading text-2xl font-semibold">
            {viewMode === "dispatch"
              ? "Outward control"
              : viewMode === "inward"
                ? "Inward control"
                : "Processing control"}
          </h2>
          <Badge className="mt-4" variant="outline">
            scan, receive, grade, pick, gate, POD
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {steps.map((step) => (
            <div
              key={step.title}
              className={cn(
                "rounded-2xl border p-4 transition",
                step.active
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-surface-alt/30"
              )}
            >
              <Badge variant={step.active ? "default" : "outline"}>
                {step.active ? "Open" : "Monitor"}
              </Badge>
              <h3 className="mt-3 font-heading text-base font-semibold">{step.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{step.owner}</p>
              <p className="mt-3 rounded-lg border border-border bg-background/70 px-2 py-1 text-xs font-medium">
                {step.kpi}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildDispatchSlaRows(gatePasses: GatePassRow[]) {
  const active = gatePasses.filter((pass) => pass.status !== "Cancelled");
  const awaitingPack = active.filter((pass) => pass.status === "Picked").length;
  const awaitingReady = active.filter((pass) => pass.status === "Packed").length;
  const awaitingGate = active.filter((pass) => pass.status === "Ready" && !pass.securityGateOutAt).length;
  const awaitingDriver = active.filter((pass) => pass.securityGateOutAt && pass.status !== "Dispatched").length;
  const podPending = active.filter((pass) => pass.status === "Dispatched" && !pass.podRef).length;

  return [
    {
      role: "Picker",
      value: awaitingPack.toString(),
      hint: "picked loads waiting for packing",
      tone: awaitingPack > 0 ? "text-warning" : "text-success",
    },
    {
      role: "Packer",
      value: awaitingReady.toString(),
      hint: "packed status not yet ready",
      tone: awaitingReady > 0 ? "text-warning" : "text-success",
    },
    {
      role: "Billing",
      value: active.filter((pass) => pass.status === "Ready" && !pass.vehicleSealNo).length.toString(),
      hint: "ready loads missing seal/proof",
      tone: active.some((pass) => pass.status === "Ready" && !pass.vehicleSealNo) ? "text-danger" : "text-success",
    },
    {
      role: "Security",
      value: awaitingGate.toString(),
      hint: "ready loads awaiting OTP gate exit",
      tone: awaitingGate > 0 ? "text-warning" : "text-success",
    },
    {
      role: "Driver / POD",
      value: `${awaitingDriver}/${podPending}`,
      hint: "gate-cleared pending dispatch / POD pending",
      tone: awaitingDriver + podPending > 0 ? "text-warning" : "text-success",
    },
  ];
}

function WarehouseInwardBoard({
  containers,
  stock,
  canReceive,
  onReceive,
}: {
  containers: WarehouseInwardContainer[];
  stock: StockItemRow[];
  canReceive: boolean;
  onReceive: () => void;
}) {
  const upstream = containers.filter((container) => container.status !== "InWarehouse");
  const ready = containers.filter((container) => container.status === "InWarehouse");
  const receivedContainers = new Map<string, { containerNo: string; blNo: string; lots: number; qty: number }>();
  for (const row of stock) {
    const current =
      receivedContainers.get(row.containerId) ??
      { containerNo: row.containerNo, blNo: row.blNo, lots: 0, qty: 0 };
    current.lots += 1;
    current.qty += row.qtyReceived;
    receivedContainers.set(row.containerId, current);
  }
  const received = Array.from(receivedContainers.values()).slice(0, 12);

  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-caps">Inward control board</p>
          <h2 className="font-heading text-2xl font-semibold">
            Containers assigned to this warehouse appear here before stock receipt.
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{upstream.length} upstream assigned</Badge>
            <Badge variant="success">{ready.length} ready for GRN</Badge>
            <Badge variant="outline">{received.length} containers received</Badge>
          </div>
        </div>
        {canReceive ? (
          <Button onClick={onReceive} disabled={ready.length === 0}>
            <Plus className="h-4 w-4" /> Receive Ready Container
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <InwardColumn
          title="1. Assigned / incoming"
          hint="Import team queue"
          count={upstream.length}
          tone="warning"
        >
          {upstream.length === 0 ? (
            <InwardEmpty text="No assigned containers waiting upstream." />
          ) : (
            upstream.map((container) => (
              <InwardContainerCard key={container.id} container={container} />
            ))
          )}
        </InwardColumn>

        <InwardColumn
          title="2. At warehouse gate"
          hint="Receiver queue"
          count={ready.length}
          tone="success"
        >
          {ready.length === 0 ? (
            <InwardEmpty text="No containers are ready for GRN." />
          ) : (
            ready.map((container) => (
              <InwardContainerCard key={container.id} container={container} ready />
            ))
          )}
        </InwardColumn>

        <InwardColumn
          title="3. Received into stock"
          hint="Processing queue"
          count={received.length}
          tone="default"
        >
          {received.length === 0 ? (
            <InwardEmpty text="No received lots yet." />
          ) : (
            received.map((item) => (
              <div key={`${item.containerNo}-${item.blNo}`} className="rounded-xl border border-border bg-background/70 p-3">
                <p className="font-medium">{item.containerNo}</p>
                <p className="font-financial text-xs text-muted-foreground">BL {item.blNo}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{item.lots} lots</Badge>
                  <Badge variant="outline">{prettyQty(item.qty)} received</Badge>
                </div>
              </div>
            ))
          )}
        </InwardColumn>
      </div>
    </section>
  );
}

function InwardColumn({
  title,
  hint,
  count,
  tone,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  tone: "default" | "success" | "warning";
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-alt/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
        <Badge variant={tone === "success" ? "success" : tone === "warning" ? "warning" : "outline"}>
          {count}
        </Badge>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function InwardEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
      {text}
    </p>
  );
}

function InwardContainerCard({
  container,
  ready = false,
}: {
  container: WarehouseInwardContainer;
  ready?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{container.containerNo}</p>
          <p className="font-financial text-xs text-muted-foreground">BL {container.blNo}</p>
        </div>
        <Badge variant={ready ? "success" : "outline"}>{container.status}</Badge>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
        <p>Warehouse: {container.warehouse ? `${container.warehouse.name} (${container.warehouse.code})` : "Not assigned"}</p>
        <p>Supplier: {container.supplier?.name ?? "Not recorded"}</p>
        <p>Item: {[container.item, container.variety].filter(Boolean).join(" / ") || "Not recorded"}</p>
        <p>ETA: {container.eta ? formatDate(container.eta) : "Not recorded"}</p>
        <p>Assigned: {container.warehouseAssignedAt ? formatDate(container.warehouseAssignedAt) : "Not recorded"}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/containers/${container.id}`}>Open container</Link>
        </Button>
        {ready ? (
          <Badge variant="success">Ready for GRN</Badge>
        ) : (
          <Badge variant="warning">Waiting previous team</Badge>
        )}
      </div>
    </div>
  );
}

async function uploadDispatchProof(
  gatePassId: string,
  file: File,
  kind: "loading-proof" | "pod" = "loading-proof"
) {
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
    throw new Error("Only PDF, JPG or PNG files are allowed for dispatch proof");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Dispatch proof exceeds ${formatBytes(MAX_FILE_SIZE)}`);
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `warehouse-dispatch/${gatePassId}/${kind}/${Date.now()}_${safeName}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) {
    throw new Error(`Proof upload failed: ${error.message}`);
  }
  return path;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  busy,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      className="gap-1.5"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </Button>
  );
}

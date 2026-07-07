import { NextResponse, type NextRequest } from "next/server";

import { logActivity } from "@/lib/activity";
import { computeCost, computeProfit } from "@/lib/finance";
import { PORTS } from "@/lib/constants";
import { requireSession } from "@/lib/auth";
import { getWarehouseOptions } from "@/lib/data/warehouses";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/ratelimit";
import type { MappedRow } from "@/lib/import/mapping";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  warnings: string[];
  warehouseAssigned: number;
  warehouseMatched: number;
  warehouseUnresolved: number;
}

const CONTAINER_STATUSES = new Set([
  "Booked",
  "InTransit",
  "AtPort",
  "CustomsClearance",
  "Cleared",
  "InWarehouse",
  "EmptyReturned",
  "PartiallySold",
  "FullySold",
]);

type ContainerStatusValue =
  | "Booked"
  | "InTransit"
  | "AtPort"
  | "CustomsClearance"
  | "Cleared"
  | "InWarehouse"
  | "EmptyReturned"
  | "PartiallySold"
  | "FullySold";

const STATUS_ALIASES: Record<string, string> = {
  booked: "Booked",
  intransit: "InTransit",
  "in transit": "InTransit",
  atport: "AtPort",
  "at port": "AtPort",
  customsclearance: "CustomsClearance",
  "customs clearance": "CustomsClearance",
  cleared: "Cleared",
  inwarehouse: "InWarehouse",
  "in warehouse": "InWarehouse",
  partiallysold: "PartiallySold",
  "partially sold": "PartiallySold",
  fullysold: "FullySold",
  "fully sold": "FullySold",
  emptyreturned: "EmptyReturned",
  "empty returned": "EmptyReturned",
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return STATUS_ALIASES[key] ?? STATUS_ALIASES[key.replace(/[^a-z0-9]/g, "")] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const rl = rateLimit(`import:${session.userId}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many imports - retry in ${rl.retryAfter}s` },
        { status: 429 }
      );
    }
    if (!can(session.role, "import")) {
      return NextResponse.json(
        { error: "You do not have permission to import data" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { rows?: MappedRow[] };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 422 });
    }

    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      warehouseAssigned: 0,
      warehouseMatched: 0,
      warehouseUnresolved: 0,
    };

    const existing = await prisma.container.findMany({
      where: { orgId: session.orgId },
      select: { containerNo: true, blNo: true },
    });
    const seenContainerNos = new Set(existing.map((c) => c.containerNo));
    const seenBlNos = new Set(existing.map((c) => c.blNo));

    const activeWarehouses = await getWarehouseOptions(session.orgId);
    const warehouseCache = new Map<string, (typeof activeWarehouses)[number]>();
    for (const warehouse of activeWarehouses) {
      for (const key of [
        warehouse.id,
        warehouse.code,
        warehouse.name,
        `${warehouse.code} ${warehouse.name}`,
      ]) {
        warehouseCache.set(normalize(key), warehouse);
      }
    }
    const pilotWarehouse = activeWarehouses.length === 1 ? activeWarehouses[0] : null;

    function resolveWarehouse(row: MappedRow) {
      for (const candidate of [row.warehouseCode, row.warehouseName, row.customer]) {
        if (!candidate) continue;
        const found = warehouseCache.get(normalize(candidate));
        if (found) return found;
      }
      return pilotWarehouse;
    }

    const supplierCache = new Map<string, string>();
    async function resolveSupplier(name: string | null): Promise<string | null> {
      if (!name) return null;
      const key = name.trim();
      if (supplierCache.has(key)) return supplierCache.get(key)!;
      let supplier = await prisma.supplier.findFirst({
        where: { orgId: session.orgId, name: key, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: {
            orgId: session.orgId,
            name: key,
            approvalStatus: "PendingApproval",
            requestedById: session.userId,
            reviewNotes: "Created during import; supplier approval required.",
          },
          select: { id: true },
        });
      }
      supplierCache.set(key, supplier.id);
      return supplier.id;
    }

    let nextSl =
      (
        await prisma.container.aggregate({
          where: { orgId: session.orgId },
          _max: { slNo: true },
        })
      )._max.slNo ?? 0;

    for (const row of rows) {
      if (!row.containerNo) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: "Missing Container No - skipped",
        });
        continue;
      }
      if (!row.blNo) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: `Missing BL No for Container ${row.containerNo} - skipped`,
        });
        continue;
      }
      if (seenContainerNos.has(row.containerNo)) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: `Duplicate Container No ${row.containerNo} - skipped`,
        });
        continue;
      }
      if (seenBlNos.has(row.blNo)) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: `Duplicate BL No ${row.blNo} - skipped`,
        });
        continue;
      }

      try {
        const supplierId = await resolveSupplier(row.supplierName);
        const warehouse = resolveWarehouse(row);
        const resolvedStatus = resolveStatus(row.sourceStatus);
        const status: ContainerStatusValue =
          resolvedStatus && CONTAINER_STATUSES.has(resolvedStatus)
            ? (resolvedStatus as ContainerStatusValue)
            : warehouse
              ? "InWarehouse"
              : "Booked";

        const cost = computeCost(
          {
            beInvoiceValueInr: row.beInvoiceValueInr,
            customsDuty: row.customsDuty,
            clearingCharges: row.clearingCharges,
            linerCharges: row.linerCharges,
            detention: row.detention,
            chaCharges: row.chaCharges,
            transport: row.transport,
            ohProportion: row.ohProportion,
            claimDeduction: row.claimDeduction,
          },
          row.noOfBoxes
        );
        const profit = computeProfit(
          {
            saleValue: row.saleValue,
            damageValue: row.damageValue,
            soldQty: row.soldQty,
          },
          cost.totalCost
        );

        const portCode = row.port
          ? PORTS.find((p) => p.name.toLowerCase() === row.port!.toLowerCase())?.code
          : undefined;

        nextSl += 1;
        const slNo = row.slNo ?? nextSl;

        let lastFreeDate: Date | null = null;
        if (row.eta && row.freeDays) {
          const d = new Date(row.eta);
          d.setDate(d.getDate() + row.freeDays);
          lastFreeDate = d;
        }

        await prisma.$transaction(async (tx) => {
          const container = await tx.container.create({
            data: {
              orgId: session.orgId,
              slNo,
              containerNo: row.containerNo!,
              blNo: row.blNo!,
              supplierId,
              customer: row.customer,
              port: row.port,
              portCode,
              pol: row.pol,
              origin: row.origin,
              line: row.line,
              vessel: row.vessel,
              transhipment: row.transhipment,
              item: row.item,
              packageType: row.packageType,
              perPackageWeight: row.perPackageWeight,
              noOfBoxes: row.noOfBoxes,
              transitTime: row.transitTime,
              etd: row.etd ? new Date(row.etd) : null,
              eta: row.eta ? new Date(row.eta) : null,
              doUpto: row.doUpto ? new Date(row.doUpto) : null,
              emptyReturnDate: row.emptyReturnDate ? new Date(row.emptyReturnDate) : null,
              freeDays: row.freeDays,
              lastFreeDate,
              warehouseId: warehouse?.id,
              warehouseAssignedAt: warehouse ? new Date() : undefined,
              warehouseAssignedById: warehouse ? session.userId : undefined,
              status,
            },
          });

          if (warehouse) {
            result.warehouseMatched += 1;
            result.warehouseAssigned += 1;
          } else {
            result.warehouseUnresolved += 1;
          }

          const hasShipment =
            row.beNo ||
            row.invoiceNo ||
            row.packingListNo ||
            row.invoiceValueUsd ||
            row.netWeightKg;
          if (hasShipment) {
            await tx.shipmentItem.create({
              data: {
                orgId: session.orgId,
                containerId: container.id,
                beNo: row.beNo,
                beDate: row.beDate ? new Date(row.beDate) : null,
                invoiceNo: row.invoiceNo,
                packingListNo: row.packingListNo,
                invoiceValue: row.invoiceValueUsd,
                invoiceCurrency: "USD",
                netWeightKg: row.netWeightKg,
              },
            });
          }

          const hasCost =
            row.beInvoiceValueInr ||
            row.customsDuty ||
            row.clearingCharges ||
            row.transport ||
            cost.totalCost > 0;
          if (hasCost) {
            await tx.containerCost.create({
              data: {
                orgId: session.orgId,
                containerId: container.id,
                beInvoiceValueInr: row.beInvoiceValueInr,
                customsDuty: row.customsDuty,
                clearingCharges: row.clearingCharges,
                linerCharges: row.linerCharges,
                detention: row.detention,
                chaCharges: row.chaCharges,
                transport: row.transport,
                ohProportion: row.ohProportion,
                claimDeduction: row.claimDeduction,
                totalCost: cost.totalCost,
                ratePerBoxLanding: cost.ratePerBoxLanding,
                ratePerBox: cost.ratePerBox,
              },
            });
          }

          if (row.saleValue != null || row.soldQty != null) {
            await tx.sale.create({
              data: {
                orgId: session.orgId,
                containerId: container.id,
                soldQty: row.soldQty,
                avgPrice: row.avgPrice,
                saleValue: row.saleValue,
                damageQty: row.damageQty,
                damageValue: row.damageValue,
                profit: profit.profit,
                profitPerBox: profit.profitPerBox,
                marginPct: profit.marginPct,
                approvalStatus: "Draft",
                reviewNotes:
                  "Imported from tracker; finance review required before sales become operational.",
              },
            });
          }

          if (row.amountRequested != null) {
            await tx.payment.create({
              data: {
                orgId: session.orgId,
                containerId: container.id,
                supplierName: row.supplierName,
                amountRequested: row.amountRequested,
                currency: "USD",
                requestDate: row.requestDate ? new Date(row.requestDate) : null,
                status: "Pending",
                approvalStatus: "Draft",
                notes: "Imported from tracker; finance review required before approval.",
              },
            });
          }

          const externalMappings = [
            row.carrierExternalId
              ? { provider: "carrier", externalId: row.carrierExternalId }
              : null,
            row.wmsExternalId ? { provider: "wms", externalId: row.wmsExternalId } : null,
            row.erpExternalId ? { provider: "erp", externalId: row.erpExternalId } : null,
            row.tallyExternalId ? { provider: "tally", externalId: row.tallyExternalId } : null,
            row.icegateExternalId
              ? { provider: "icegate", externalId: row.icegateExternalId }
              : null,
          ].filter((value): value is { provider: string; externalId: string } => !!value);

          for (const mapping of externalMappings) {
            await tx.externalReference.upsert({
              where: {
                orgId_provider_entityType_entityId: {
                  orgId: session.orgId,
                  provider: mapping.provider,
                  entityType: "container",
                  entityId: container.id,
                },
              },
              create: {
                orgId: session.orgId,
                provider: mapping.provider,
                entityType: "container",
                entityId: container.id,
                externalId: mapping.externalId.trim(),
                metadata: {
                  source: "Excel import",
                  rowNumber: row.rowNumber,
                  containerNo: row.containerNo,
                  blNo: row.blNo,
                },
              },
              update: {
                externalId: mapping.externalId.trim(),
                metadata: {
                  source: "Excel import",
                  rowNumber: row.rowNumber,
                  containerNo: row.containerNo,
                  blNo: row.blNo,
                },
              },
            });
          }
        });

        seenContainerNos.add(row.containerNo);
        seenBlNos.add(row.blNo);
        result.imported += 1;
      } catch (err) {
        console.error(`[import] row ${row.rowNumber} failed`, err);
        result.errors.push({
          row: row.rowNumber,
          message: err instanceof Error ? err.message : "Insert failed",
        });
      }
    }

    if (result.warehouseUnresolved > 0) {
      result.warnings.push(
        `${result.warehouseUnresolved} row(s) had no warehouse match and were left unassigned`
      );
    }

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "imported",
      entityType: "container",
      summary: `Imported ${result.imported} containers (${result.skipped} skipped)`,
      metadata: {
        imported: result.imported,
        skipped: result.skipped,
        warehouseAssigned: result.warehouseAssigned,
        warehouseMatched: result.warehouseMatched,
        warehouseUnresolved: result.warehouseUnresolved,
      },
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("[api/import]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

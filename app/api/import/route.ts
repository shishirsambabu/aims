import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { computeCost, computeProfit } from "@/lib/finance";
import { PORTS } from "@/lib/constants";
import type { MappedRow } from "@/lib/import/mapping";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const rl = rateLimit(`import:${session.userId}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many imports — retry in ${rl.retryAfter}s` }, { status: 429 });
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

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    // Existing container numbers for duplicate detection.
    const existing = await prisma.container.findMany({
      where: { orgId: session.orgId },
      select: { containerNo: true },
    });
    const seen = new Set(existing.map((c: { containerNo: string }) => c.containerNo));

    // Supplier name → id cache (find or create).
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
          data: { orgId: session.orgId, name: key },
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
          message: "Missing Container No — skipped",
        });
        continue;
      }
      if (!row.blNo) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: `Missing BL No for Container ${row.containerNo} — skipped`,
        });
        continue;
      }
      if (seen.has(row.containerNo)) {
        result.skipped += 1;
        result.errors.push({
          row: row.rowNumber,
          message: `Duplicate Container No ${row.containerNo} — skipped`,
        });
        continue;
      }

      try {
        const supplierId = await resolveSupplier(row.supplierName);
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
          ? PORTS.find((p) => p.name.toLowerCase() === row.port!.toLowerCase())
              ?.code
          : undefined;

        nextSl += 1;
        const slNo = row.slNo ?? nextSl;

        // Free time auto-calculated from ETA + free days.
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
              emptyReturnDate: row.emptyReturnDate
                ? new Date(row.emptyReturnDate)
                : null,
              freeDays: row.freeDays,
              lastFreeDate,
              status: "Booked",
            },
          });

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
        });

        seen.add(row.containerNo);
        result.imported += 1;
      } catch (err) {
        console.error(`[import] row ${row.rowNumber} failed`, err);
        result.errors.push({
          row: row.rowNumber,
          message: err instanceof Error ? err.message : "Insert failed",
        });
      }
    }

    await logActivity({
      orgId: session.orgId,
      userId: session.userId,
      action: "imported",
      entityType: "container",
      summary: `Imported ${result.imported} containers (${result.skipped} skipped)`,
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

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getPublishedPriceListForWarehouse,
  buildPriceMatchKey,
} from "@/lib/data/sales";
import { listSalesQuotes } from "@/lib/data/quotes";
import { salesQuoteSchema } from "@/lib/validations/sales";
import { nextDocumentNumber } from "@/lib/document-sequence";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "sales.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const data = await listSalesQuotes(
      session.orgId,
      session.role === "sales_executive" ? session.userId : undefined
    );
    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "salesorder.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = salesQuoteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;
    const quoteDate = new Date(Date.UTC(
      input.quoteDate.getUTCFullYear(),
      input.quoteDate.getUTCMonth(),
      input.quoteDate.getUTCDate()
    ));

    const [customer, warehouse] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          id: input.customerId,
          orgId: session.orgId,
          deletedAt: null,
          ...(session.role === "sales_executive" ? { assignedRepId: session.userId } : {}),
        },
        select: { id: true, name: true, code: true, kycStatus: true, approvalStatus: true, creditHold: true },
      }),
      prisma.warehouse.findFirst({
        where: { id: input.warehouseId, orgId: session.orgId, deletedAt: null, isActive: true },
        select: { id: true, name: true, code: true, city: true },
      }),
    ]);

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    if (customer.approvalStatus !== "Approved" || customer.kycStatus !== "Approved") {
      return NextResponse.json(
        { error: "Customer must be approved and KYC cleared before quoting" },
        { status: 409 }
      );
    }
    if (customer.creditHold) {
      return NextResponse.json({ error: "Customer is on credit hold" }, { status: 409 });
    }

    const priceList = input.priceListId
      ? await prisma.priceList.findFirst({
          where: {
            id: input.priceListId,
            orgId: session.orgId,
            warehouseId: warehouse.id,
            priceDate: quoteDate,
            status: "Published",
          },
          include: { items: true },
        })
      : await getPublishedPriceListForWarehouse(session.orgId, warehouse.id, quoteDate);

    if (!priceList) {
      return NextResponse.json(
        { error: "Publish a day price for this warehouse before creating quotes" },
        { status: 409 }
      );
    }

    const stockIds = [...new Set(input.lines.map((line) => line.stockItemId).filter(Boolean) as string[])];
    const stockItems = stockIds.length
      ? await prisma.stockItem.findMany({
          where: {
            id: { in: stockIds },
            orgId: session.orgId,
            deletedAt: null,
            warehouseId: warehouse.id,
            qualityStatus: "Released",
          },
          select: {
            id: true,
            item: true,
            variety: true,
            grade: true,
            uom: true,
            qtyAvailable: true,
            container: { select: { containerNo: true, blNo: true } },
          },
        })
      : [];

    if (stockItems.length !== stockIds.length) {
      return NextResponse.json({ error: "One or more stock items were not found" }, { status: 404 });
    }

    const lineChecks = input.lines.map((line) => {
      const stock = line.stockItemId ? stockItems.find((row) => row.id === line.stockItemId) : null;
      const qty = Number(line.qty);
      const unitPrice = Number(line.unitPrice);
      const discountAmount = Number(line.discountAmount ?? 0);
      const lineTotal = Math.max(0, qty * unitPrice - discountAmount);
      const priceMatch = priceList.items.find((item) =>
        buildPriceMatchKey({
          item: line.item,
          variety: line.variety ?? null,
          grade: line.grade ?? null,
          uom: line.uom,
        }) === buildPriceMatchKey(item)
      );
      if (!priceMatch) {
        throw new Error("NO_PRICE_FOR_QUOTE_LINE");
      }
      const floorPrice = Number(priceMatch.floorPrice);
      const effectiveUnitPrice = qty > 0 ? lineTotal / qty : unitPrice;
      const basePrice = Number(priceMatch.basePrice);
      const effectiveDiscountPct = basePrice > 0 ? ((basePrice - effectiveUnitPrice) / basePrice) * 100 : 0;
      const exceedsDiscountLimit = priceMatch.maxDiscountPct != null && effectiveDiscountPct > Number(priceMatch.maxDiscountPct) + 0.0001;
      const requiresOverride = effectiveUnitPrice < floorPrice || exceedsDiscountLimit;
      if (requiresOverride && !can(session.role, "price.override.approve")) {
        throw new Error(exceedsDiscountLimit ? "DISCOUNT_LIMIT_EXCEEDED" : "PRICE_BELOW_FLOOR");
      }
      if (requiresOverride && !input.pricingOverrideReason) {
        throw new Error("OVERRIDE_REASON_REQUIRED");
      }
      return {
        stock,
        stockItemId: line.stockItemId ?? null,
        item: line.item,
        variety: line.variety ?? null,
        grade: line.grade ?? null,
        uom: line.uom,
        qty,
        unitPrice,
        floorPrice,
        priceListItemId: priceMatch.id,
        discountAmount,
        lineTotal,
        notes: line.notes ?? null,
      };
    });

    const grossAmount = lineChecks.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
    const discountAmount = lineChecks.reduce((sum, line) => sum + line.discountAmount, 0);
    const netAmount = lineChecks.reduce((sum, line) => sum + line.lineTotal, 0);

    const created = await prisma.$transaction(async (tx) => {
      const quoteNo = await nextDocumentNumber(tx, session.orgId, `sales-quote:${dayKey(quoteDate)}`, `QT-${dayKey(quoteDate)}`);
      const quote = await tx.salesQuote.create({
        data: {
          orgId: session.orgId,
          quoteNo,
          customerId: customer.id,
          warehouseId: warehouse.id,
          priceListId: priceList?.id ?? null,
          quoteDate,
          expiresAt: input.expiresAt ?? null,
          status: "Draft",
          approvalStatus: "Draft",
          createdById: session.userId,
          notes: input.notes ?? null,
          grossAmount,
          discountAmount,
          netAmount,
        },
      });

      for (let index = 0; index < lineChecks.length; index += 1) {
        const line = lineChecks[index];
        await tx.salesQuoteLine.create({
          data: {
            orgId: session.orgId,
            salesQuoteId: quote.id,
            lineNo: index + 1,
            stockItemId: line.stockItemId,
            priceListItemId: line.priceListItemId,
            item: line.item,
            variety: line.variety,
            grade: line.grade,
            uom: line.uom,
            qty: line.qty,
            unitPrice: line.unitPrice,
            floorPrice: line.floorPrice,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
            notes: line.notes,
          },
        });
      }

      await tx.salesQuoteRevision.create({
        data: {
          orgId: session.orgId,
          salesQuoteId: quote.id,
          revisionNo: 1,
          changeType: "created",
          snapshot: {
            quoteNo,
            customerId: customer.id,
            warehouseId: warehouse.id,
            priceListId: priceList?.id ?? null,
            quoteDate,
            expiresAt: input.expiresAt ?? null,
            notes: input.notes ?? null,
            lines: lineChecks,
            grossAmount,
            discountAmount,
            netAmount,
            pricingOverrideReason: input.pricingOverrideReason ?? null,
          },
        },
      });

      await writeActivity(tx, {
        orgId: session.orgId,
        userId: session.userId,
        action: "created_sales_quote",
        entityType: "sales_quote",
        entityId: quote.id,
        summary: `Created quote ${quoteNo} for ${customer.name}`,
        metadata: { quoteId: quote.id, quoteNo, pricingOverrideReason: input.pricingOverrideReason ?? null },
      });

      return quote;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (err instanceof Error && err.message === "PRICE_BELOW_FLOOR") {
      return NextResponse.json({ error: "Unit price cannot go below the floor price" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "NO_PRICE_FOR_QUOTE_LINE") {
      return NextResponse.json({ error: "Every quote line must match a published day-price row" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "DISCOUNT_LIMIT_EXCEEDED") {
      return NextResponse.json({ error: "Discount exceeds the published maximum for this price row" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "OVERRIDE_REASON_REQUIRED") {
      return NextResponse.json({ error: "A pricing override reason is required" }, { status: 422 });
    }
    console.error("[api/quotes POST]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  console.error("[api/quotes]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

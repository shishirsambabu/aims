import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSalesQuoteById } from "@/lib/data/quotes";
import { salesQuoteActionSchema } from "@/lib/validations/sales";
import { buildPriceMatchKey } from "@/lib/data/sales";
import { redactRestrictedFinancialFields } from "@/lib/redaction";

interface Params {
  params: Promise<{ id: string }>;
}

function dec(value: unknown): number {
  return value == null ? 0 : Number(value);
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "sales.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const quote = await getSalesQuoteById(
      session.orgId,
      id,
      session.role === "sales_executive" ? session.userId : undefined
    );
    if (!quote) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const canViewFloor = can(session.role, "price.floor.view") || can(session.role, "financials.view");
    const data = canViewFloor
      ? quote
      : {
          ...quote,
          lines: quote.lines.map((line) => ({ ...line, floorPrice: null })),
          revisions: quote.revisions.map((revision) => ({
            ...revision,
            snapshot: redactRestrictedFinancialFields(revision.snapshot),
          })),
        };
    return NextResponse.json({ data });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireSession();
    if (!can(session.role, "salesorder.write")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const parsed = salesQuoteActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const existing = await prisma.salesQuote.findFirst({
      where: {
        id,
        orgId: session.orgId,
        ...(session.role === "sales_executive"
          ? { customer: { assignedRepId: session.userId } }
          : {}),
      },
      include: { lines: true, revisions: true, priceList: { include: { items: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.convertedAt) {
      return NextResponse.json({ error: "Converted quotes cannot be changed" }, { status: 409 });
    }

    const action = parsed.data.action;
    if (action === "approve" && !can(session.role, "salesorder.approve")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    if ((action === "approve" || action === "reject") && existing.createdById === session.userId) {
      return NextResponse.json(
        { error: "Maker-checker control: the quote creator cannot review their own quote" },
        { status: 409 }
      );
    }
    if ((action === "approve" || action === "reject") && existing.approvalStatus !== "PendingApproval") {
      return NextResponse.json({ error: "Only submitted quotes can be reviewed" }, { status: 409 });
    }

    const note = parsed.data.reason?.trim() || parsed.data.notes?.trim() || null;
    const amendedLines =
      action === "amend" && parsed.data.lines
        ? parsed.data.lines.map((line) => {
            const priceMatch = existing.priceList?.items.find(
              (item) =>
                buildPriceMatchKey(item) ===
                buildPriceMatchKey({
                  item: line.item,
                  variety: line.variety ?? null,
                  grade: line.grade ?? null,
                  uom: line.uom,
                })
            );
            if (!priceMatch) throw new Error("NO_PRICE_FOR_QUOTE_LINE");
            const qty = Number(line.qty ?? 0);
            const unitPrice = Number(line.unitPrice ?? 0);
            const discountAmount = Number(line.discountAmount ?? 0);
            const lineTotal = Math.max(0, qty * unitPrice - discountAmount);
            const effectiveUnitPrice = qty > 0 ? lineTotal / qty : unitPrice;
            const basePrice = Number(priceMatch.basePrice);
            const effectiveDiscountPct = basePrice > 0 ? ((basePrice - effectiveUnitPrice) / basePrice) * 100 : 0;
            const exceedsDiscountLimit = priceMatch.maxDiscountPct != null && effectiveDiscountPct > Number(priceMatch.maxDiscountPct) + 0.0001;
            const requiresOverride = effectiveUnitPrice < Number(priceMatch.floorPrice) || exceedsDiscountLimit;
            if (requiresOverride && !can(session.role, "price.override.approve")) {
              throw new Error(exceedsDiscountLimit ? "DISCOUNT_LIMIT_EXCEEDED" : "PRICE_BELOW_FLOOR");
            }
            if (requiresOverride && !parsed.data.pricingOverrideReason) {
              throw new Error("OVERRIDE_REASON_REQUIRED");
            }
            return {
              ...line,
              qty,
              unitPrice,
              discountAmount,
              lineTotal,
              floorPrice: Number(priceMatch.floorPrice),
              priceListItemId: priceMatch.id,
            };
          })
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      let nextQuote = existing;

      if (action === "amend" && amendedLines) {
        const quoteDate = parsed.data.quoteDate ?? existing.quoteDate;
        const expiresAt = parsed.data.expiresAt ?? existing.expiresAt;
        const grossAmount = amendedLines.reduce(
          (sum, line) => sum + Number(line.qty ?? 0) * Number(line.unitPrice ?? 0),
          0
        );
        const discountAmount = amendedLines.reduce(
          (sum, line) => sum + Number(line.discountAmount ?? 0),
          0
        );
        const netAmount = amendedLines.reduce(
          (sum, line) =>
            sum +
            Math.max(
              0,
              Number(line.qty ?? 0) * Number(line.unitPrice ?? 0) - Number(line.discountAmount ?? 0)
            ),
          0
        );

        await tx.salesQuoteLine.deleteMany({ where: { salesQuoteId: existing.id } });
        for (let index = 0; index < amendedLines.length; index += 1) {
          const line = amendedLines[index];
          await tx.salesQuoteLine.create({
            data: {
              orgId: session.orgId,
              salesQuoteId: existing.id,
              lineNo: index + 1,
              stockItemId: line.stockItemId ?? null,
              priceListItemId: line.priceListItemId,
              item: line.item,
              variety: line.variety ?? null,
              grade: line.grade ?? null,
              uom: line.uom,
              qty: Number(line.qty ?? 0),
              unitPrice: Number(line.unitPrice ?? 0),
              floorPrice: line.floorPrice,
              discountAmount: line.discountAmount ?? 0,
              lineTotal: line.lineTotal,
              notes: line.notes ?? null,
            },
          });
        }

        nextQuote = await tx.salesQuote.update({
          where: { id: existing.id },
          data: {
            quoteDate,
            expiresAt: expiresAt ?? null,
            notes: parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
            status: "Draft",
            approvalStatus: "Draft",
            submittedAt: null,
            approvedAt: null,
            rejectedAt: null,
            grossAmount,
            discountAmount,
            netAmount,
          },
          include: { lines: true, revisions: true, priceList: { include: { items: true } } },
        });
      } else {
        nextQuote = await tx.salesQuote.update({
          where: { id: existing.id },
          data: {
            status:
              action === "submit"
                ? "PendingApproval"
                : action === "approve"
                  ? "Approved"
                  : action === "reject"
                    ? "Rejected"
                    : undefined,
            approvalStatus:
              action === "submit"
                ? "PendingApproval"
                : action === "approve"
                  ? "Approved"
                  : action === "reject"
                    ? "Rejected"
                    : undefined,
            submittedAt: action === "submit" ? new Date() : undefined,
            approvedAt: action === "approve" ? new Date() : undefined,
            rejectedAt: action === "reject" ? new Date() : undefined,
            notes: parsed.data.notes !== undefined ? parsed.data.notes : undefined,
          },
          include: { lines: true, revisions: true, priceList: { include: { items: true } } },
        });
      }

      const revisionNo = (await tx.salesQuoteRevision.count({
        where: { orgId: session.orgId, salesQuoteId: existing.id },
      })) + 1;
      await tx.salesQuoteRevision.create({
        data: {
          orgId: session.orgId,
          salesQuoteId: existing.id,
          revisionNo,
          changeType: action,
          note,
          snapshot: {
            quote: nextQuote,
            lines: nextQuote.lines.map((line) => ({
              ...line,
              qty: dec(line.qty),
              unitPrice: dec(line.unitPrice),
              floorPrice: dec(line.floorPrice),
              discountAmount: dec(line.discountAmount),
              lineTotal: dec(line.lineTotal),
            })),
            pricingOverrideReason: parsed.data.pricingOverrideReason ?? null,
          },
        },
      });

      await writeActivity(tx, {
        orgId: session.orgId,
        userId: session.userId,
        action: `quote_${action}`,
        entityType: "sales_quote",
        entityId: nextQuote.id,
        summary: `${action.charAt(0).toUpperCase()}${action.slice(1)} quote ${nextQuote.quoteNo}`,
        metadata: { quoteId: nextQuote.id, action, note, pricingOverrideReason: parsed.data.pricingOverrideReason ?? null },
      });

      return nextQuote;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const canViewFloor = can(session.role, "price.floor.view") || can(session.role, "financials.view");
    return NextResponse.json({
      data: canViewFloor ? updated : redactRestrictedFinancialFields(updated),
    });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof Error && err.message === "PRICE_BELOW_FLOOR") {
    return NextResponse.json({ error: "Effective quote price cannot go below the floor price" }, { status: 409 });
  }
  if (err instanceof Error && err.message === "NO_PRICE_FOR_QUOTE_LINE") {
    return NextResponse.json({ error: "Every amended line must match the quote's day-price row" }, { status: 409 });
  }
  if (err instanceof Error && err.message === "DISCOUNT_LIMIT_EXCEEDED") {
    return NextResponse.json({ error: "Discount exceeds the published maximum for this price row" }, { status: 409 });
  }
  if (err instanceof Error && err.message === "OVERRIDE_REASON_REQUIRED") {
    return NextResponse.json({ error: "A pricing override reason is required" }, { status: 422 });
  }
  console.error("[api/quotes/:id]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  listWarehouseLocations,
  listWarehouseCycleCounts,
  listWarehouseAdvancedOps,
} from "@/lib/data/warehouse-ops";
import { nextDocumentNumber } from "@/lib/document-sequence";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredDate(value: unknown) {
  const text = normalize(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!can(session.role, "inventory.view")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const [locations, cycleCounts, advancedOps] = await Promise.all([
      listWarehouseLocations(session.orgId),
      listWarehouseCycleCounts(session.orgId),
      listWarehouseAdvancedOps(session.orgId),
    ]);
    return NextResponse.json({ data: { locations, cycleCounts, advancedOps } });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "warehouse.adjust") && !can(session.role, "warehouse.receive")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    if (body.kind === "location") {
      const warehouseId = normalize(body.warehouseId);
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, orgId: session.orgId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!warehouse || !normalize(body.code) || !normalize(body.name)) {
        return NextResponse.json({ error: "Valid warehouse, code, and name are required" }, { status: 422 });
      }
      const parentId = normalize(body.parentId) || null;
      if (parentId) {
        const parent = await prisma.warehouseLocation.count({
          where: { id: parentId, orgId: session.orgId, warehouseId },
        });
        if (parent !== 1) {
          return NextResponse.json({ error: "Parent location must belong to the same warehouse" }, { status: 422 });
        }
      }
      const location = await prisma.warehouseLocation.create({
        data: {
          orgId: session.orgId,
          warehouseId,
          parentId,
          code: normalize(body.code),
          name: normalize(body.name),
          type: body.type || "Room",
          sortOrder: body.sortOrder ? Number(body.sortOrder) : 0,
          capacityUnits: body.capacityUnits ? Number(body.capacityUnits) : null,
          temperatureMinC: body.temperatureMinC !== "" && body.temperatureMinC != null ? Number(body.temperatureMinC) : null,
          temperatureMaxC: body.temperatureMaxC !== "" && body.temperatureMaxC != null ? Number(body.temperatureMaxC) : null,
          notes: normalize(body.notes) || null,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "created_warehouse_location",
        entityType: "warehouse_location",
        entityId: location.id,
        summary: `Created location ${location.code}`,
        metadata: { after: location },
      });
      return NextResponse.json({ data: location }, { status: 201 });
    }

    if (body.kind === "cycle-count") {
      const count = await prisma.$transaction(async (tx) => {
        const countNo = await nextDocumentNumber(tx, session.orgId, "cycle-count", "CC");
        return tx.warehouseCycleCount.create({
          data: {
            orgId: session.orgId,
            warehouseId: normalize(body.warehouseId),
            countNo,
            status: body.status || "Draft",
            scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
            notes: normalize(body.notes) || null,
            createdById: session.userId,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "created_cycle_count",
        entityType: "warehouse_cycle_count",
        entityId: count.id,
        summary: `Created cycle count ${count.countNo}`,
        metadata: { after: count },
      });
      return NextResponse.json({ data: count }, { status: 201 });
    }

    if (body.kind === "dock-appointment") {
      const warehouseId = normalize(body.warehouseId);
      const scheduledStart = requiredDate(body.scheduledStart);
      const scheduledEnd = requiredDate(body.scheduledEnd);
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouseId, orgId: session.orgId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!warehouse || !scheduledStart || !scheduledEnd || !normalize(body.bayCode)) {
        return NextResponse.json({ error: "Warehouse, bay, start, and end time are required" }, { status: 422 });
      }
      const containerId = normalize(body.containerId) || null;
      if (containerId) {
        const container = await prisma.container.count({
          where: { id: containerId, orgId: session.orgId, warehouseId },
        });
        if (container !== 1) {
          return NextResponse.json({ error: "Container must belong to the selected warehouse" }, { status: 422 });
        }
      }
      const appointment = await prisma.$transaction(async (tx) => {
        const appointmentNo = await nextDocumentNumber(tx, session.orgId, "dock-appointment", "DA");
        return tx.dockAppointment.create({
          data: {
            orgId: session.orgId,
            warehouseId,
            containerId,
            appointmentNo,
            bayCode: normalize(body.bayCode),
            scheduledStart,
            scheduledEnd,
            status: normalize(body.status) || "Scheduled",
            vehicleNo: normalize(body.vehicleNo) || null,
            driverName: normalize(body.driverName) || null,
            notes: normalize(body.notes) || null,
            createdById: session.userId,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "created_dock_appointment",
        entityType: "dock_appointment",
        entityId: appointment.id,
        summary: `Scheduled dock appointment ${appointment.appointmentNo}`,
        metadata: { after: appointment },
      });
      return NextResponse.json({ data: appointment }, { status: 201 });
    }

    if (body.kind === "putaway-rule") {
      const warehouseId = normalize(body.warehouseId);
      const locationId = normalize(body.locationId);
      const location = await prisma.warehouseLocation.findFirst({
        where: { id: locationId, orgId: session.orgId, warehouseId, isActive: true },
        select: { id: true },
      });
      if (!location || !normalize(body.product)) {
        return NextResponse.json({ error: "Active location and product are required" }, { status: 422 });
      }
      const rule = await prisma.warehousePutawayRule.create({
        data: {
          orgId: session.orgId,
          warehouseId,
          locationId,
          product: normalize(body.product),
          variety: normalize(body.variety) || null,
          ripeningState: normalize(body.ripeningState) || null,
          temperatureMinC: nullableNumber(body.temperatureMinC),
          temperatureMaxC: nullableNumber(body.temperatureMaxC),
          fefoMaxDays: nullableNumber(body.fefoMaxDays),
          priority: nullableNumber(body.priority) ?? 100,
          notes: normalize(body.notes) || null,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "created_putaway_rule",
        entityType: "warehouse_putaway_rule",
        entityId: rule.id,
        summary: `Created putaway rule for ${rule.product}`,
        metadata: { after: rule },
      });
      return NextResponse.json({ data: rule }, { status: 201 });
    }

    if (body.kind === "repacking-work-order") {
      const stockItem = await prisma.stockItem.findFirst({
        where: { id: normalize(body.sourceStockItemId), orgId: session.orgId, deletedAt: null },
        select: { id: true, warehouseId: true, item: true, grade: true, qtyAvailable: true },
      });
      const plannedInputQty = nullableNumber(body.plannedInputQty);
      if (!stockItem || !plannedInputQty || plannedInputQty <= 0 || !normalize(body.outputItem)) {
        return NextResponse.json({ error: "Source lot, output item, and planned input quantity are required" }, { status: 422 });
      }
      if (plannedInputQty > Number(stockItem.qtyAvailable)) {
        return NextResponse.json({ error: "Planned input quantity exceeds available source lot quantity" }, { status: 422 });
      }
      const order = await prisma.$transaction(async (tx) => {
        const workOrderNo = await nextDocumentNumber(tx, session.orgId, "repacking-work-order", "RWO");
        return tx.repackingWorkOrder.create({
          data: {
            orgId: session.orgId,
            warehouseId: stockItem.warehouseId,
            sourceStockItemId: stockItem.id,
            workOrderNo,
            outputItem: normalize(body.outputItem),
            outputGrade: normalize(body.outputGrade) || null,
            packSpec: normalize(body.packSpec) || null,
            plannedInputQty,
            status: normalize(body.status) || "Draft",
            notes: normalize(body.notes) || null,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "created_repacking_work_order",
        entityType: "repacking_work_order",
        entityId: order.id,
        summary: `Created repacking work order ${order.workOrderNo}`,
        metadata: { after: order },
      });
      return NextResponse.json({ data: order }, { status: 201 });
    }

    if (body.kind === "qc-sampling-plan") {
      const stockItem = await prisma.stockItem.findFirst({
        where: { id: normalize(body.stockItemId), orgId: session.orgId, deletedAt: null },
        select: { id: true, warehouseId: true },
      });
      const sampleSize = nullableNumber(body.sampleSize);
      if (!stockItem || !sampleSize || sampleSize <= 0) {
        return NextResponse.json({ error: "Stock lot and sample size are required" }, { status: 422 });
      }
      const plan = await prisma.$transaction(async (tx) => {
        const planNo = await nextDocumentNumber(tx, session.orgId, "qc-sampling-plan", "QC");
        return tx.qcSamplingPlan.create({
          data: {
            orgId: session.orgId,
            warehouseId: stockItem.warehouseId,
            stockItemId: stockItem.id,
            planNo,
            sampleSize,
            defectClass: normalize(body.defectClass) || null,
            defectCount: nullableNumber(body.defectCount) ?? 0,
            severity: normalize(body.severity) || "Normal",
            photoRef: normalize(body.photoRef) || null,
            disposition: normalize(body.disposition) || "Pending",
            status: normalize(body.status) || "Open",
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "created_qc_sampling_plan",
        entityType: "qc_sampling_plan",
        entityId: plan.id,
        summary: `Created QC sampling plan ${plan.planNo}`,
        metadata: { after: plan },
      });
      return NextResponse.json({ data: plan }, { status: 201 });
    }

    if (body.kind === "productivity-log") {
      const warehouseId = normalize(body.warehouseId);
      const shiftDate = requiredDate(body.shiftDate);
      const qtyHandled = nullableNumber(body.qtyHandled);
      const hoursWorked = nullableNumber(body.hoursWorked);
      const warehouse = await prisma.warehouse.count({
        where: { id: warehouseId, orgId: session.orgId, deletedAt: null, isActive: true },
      });
      if (warehouse !== 1 || !shiftDate || !normalize(body.workerName) || !qtyHandled || !hoursWorked) {
        return NextResponse.json({ error: "Warehouse, shift, worker, quantity, and hours are required" }, { status: 422 });
      }
      const log = await prisma.warehouseProductivityLog.create({
        data: {
          orgId: session.orgId,
          warehouseId,
          shiftDate,
          shiftName: normalize(body.shiftName) || "Day",
          role: normalize(body.role) || "Receiver",
          workerName: normalize(body.workerName),
          taskType: normalize(body.taskType) || "Warehouse task",
          qtyHandled,
          uom: normalize(body.uom) || "Box",
          hoursWorked,
        },
      });
      return NextResponse.json({ data: log }, { status: 201 });
    }

    if (body.kind === "exception-approval") {
      const warehouseId = normalize(body.warehouseId);
      const warehouse = await prisma.warehouse.count({
        where: { id: warehouseId, orgId: session.orgId, deletedAt: null, isActive: true },
      });
      if (warehouse !== 1 || !normalize(body.exceptionType) || !normalize(body.reason)) {
        return NextResponse.json({ error: "Warehouse, exception type, and reason are required" }, { status: 422 });
      }
      const exception = await prisma.warehouseExceptionApproval.create({
        data: {
          orgId: session.orgId,
          warehouseId,
          refType: normalize(body.refType) || "warehouse",
          refId: normalize(body.refId) || null,
          exceptionType: normalize(body.exceptionType),
          qty: nullableNumber(body.qty),
          valueAmount: nullableNumber(body.valueAmount),
          reason: normalize(body.reason),
          requestedById: session.userId,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "requested_warehouse_exception",
        entityType: "warehouse_exception_approval",
        entityId: exception.id,
        summary: `Requested ${exception.exceptionType} approval`,
        metadata: { after: exception },
      });
      return NextResponse.json({ data: exception }, { status: 201 });
    }

    if (body.kind === "supplier-claim") {
      const containerId = normalize(body.containerId) || null;
      const stockItemId = normalize(body.stockItemId) || null;
      const container = containerId
        ? await prisma.container.findFirst({
            where: { id: containerId, orgId: session.orgId },
            select: { id: true, supplierId: true },
          })
        : null;
      const stockItem = stockItemId
        ? await prisma.stockItem.findFirst({
            where: { id: stockItemId, orgId: session.orgId, deletedAt: null },
            select: { id: true, containerId: true },
          })
        : null;
      if ((containerId && !container) || (stockItemId && !stockItem) || !normalize(body.claimType)) {
        return NextResponse.json({ error: "Valid container/stock lot and claim type are required" }, { status: 422 });
      }
      const claim = await prisma.$transaction(async (tx) => {
        const claimNo = await nextDocumentNumber(tx, session.orgId, "supplier-claim", "CLM");
        return tx.supplierClaim.create({
          data: {
            orgId: session.orgId,
            supplierId: normalize(body.supplierId) || container?.supplierId || null,
            containerId: container?.id ?? stockItem?.containerId ?? null,
            stockItemId: stockItem?.id ?? null,
            claimNo,
            claimType: normalize(body.claimType),
            claimAmount: nullableNumber(body.claimAmount),
            currency: normalize(body.currency) || "USD",
            wastageQty: nullableNumber(body.wastageQty),
            qcPhotoRef: normalize(body.qcPhotoRef) || null,
            status: normalize(body.status) || "Draft",
            notes: normalize(body.notes) || null,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "created_supplier_claim",
        entityType: "supplier_claim",
        entityId: claim.id,
        summary: `Created supplier claim ${claim.claimNo}`,
        metadata: { after: claim },
      });
      return NextResponse.json({ data: claim }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid warehouse operation" }, { status: 422 });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!can(session.role, "warehouse.adjust") && !can(session.role, "warehouse.receive")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const body = await request.json();
    if (body.kind === "location") {
      const existing = await prisma.warehouseLocation.findFirst({
        where: { id: normalize(body.id), orgId: session.orgId },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const location = await prisma.warehouseLocation.update({
        where: { id: existing.id },
        data: {
          isActive: body.isActive ?? undefined,
          sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
          notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "updated_warehouse_location",
        entityType: "warehouse_location",
        entityId: location.id,
        summary: `Updated location ${location.code}`,
        metadata: { after: location },
      });
      return NextResponse.json({ data: location });
    }

    if (body.kind === "cycle-count") {
      const existing = await prisma.warehouseCycleCount.findFirst({
        where: { id: normalize(body.id), orgId: session.orgId },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const count = await prisma.warehouseCycleCount.update({
        where: { id: existing.id },
        data: {
          status: body.status ?? undefined,
          startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
          completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
          notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "updated_cycle_count",
        entityType: "warehouse_cycle_count",
        entityId: count.id,
        summary: `Updated cycle count ${count.countNo}`,
        metadata: { after: count },
      });
      return NextResponse.json({ data: count });
    }

    if (body.kind === "dock-appointment") {
      const existing = await prisma.dockAppointment.findFirst({
        where: { id: normalize(body.id), orgId: session.orgId },
        select: { id: true, appointmentNo: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const status = normalize(body.status);
      const appointment = await prisma.dockAppointment.update({
        where: { id: existing.id },
        data: {
          status: status || undefined,
          unloadingStartedAt: status === "Unloading" ? new Date() : undefined,
          unloadingCompletedAt: status === "Completed" ? new Date() : undefined,
          notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "updated_dock_appointment",
        entityType: "dock_appointment",
        entityId: appointment.id,
        summary: `Updated dock appointment ${appointment.appointmentNo}`,
        metadata: { after: appointment },
      });
      return NextResponse.json({ data: appointment });
    }

    if (body.kind === "putaway-rule") {
      const existing = await prisma.warehousePutawayRule.findFirst({
        where: { id: normalize(body.id), orgId: session.orgId },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const rule = await prisma.warehousePutawayRule.update({
        where: { id: existing.id },
        data: {
          isActive: body.isActive ?? undefined,
          priority: body.priority !== undefined ? nullableNumber(body.priority) ?? undefined : undefined,
          notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
        },
      });
      return NextResponse.json({ data: rule });
    }

    if (body.kind === "repacking-work-order") {
      const action = normalize(body.action);
      const orderId = normalize(body.id);
      if (action !== "complete") {
        const order = await prisma.repackingWorkOrder.update({
          where: { id: orderId },
          data: {
            status: normalize(body.status) || undefined,
            startedAt: normalize(body.status) === "InProgress" ? new Date() : undefined,
            notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
          },
        });
        return NextResponse.json({ data: order });
      }

      const actualInputQty = nullableNumber(body.actualInputQty);
      const outputQty = nullableNumber(body.outputQty);
      const wastageQty = nullableNumber(body.wastageQty) ?? 0;
      if (!actualInputQty || actualInputQty <= 0 || !outputQty || outputQty <= 0) {
        return NextResponse.json({ error: "Actual input and output quantity are required" }, { status: 422 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.repackingWorkOrder.findFirst({
          where: { id: orderId, orgId: session.orgId },
          include: { sourceStockItem: true },
        });
        if (!order) throw new Error("WORK_ORDER_NOT_FOUND");
        if (order.status === "Completed") throw new Error("WORK_ORDER_ALREADY_COMPLETED");
        if (actualInputQty > Number(order.sourceStockItem.qtyAvailable)) {
          throw new Error("INSUFFICIENT_SOURCE_STOCK");
        }

        const source = await tx.stockItem.update({
          where: { id: order.sourceStockItemId },
          data: {
            qtyAvailable: { decrement: actualInputQty },
            qtyWastage: wastageQty > 0 ? { increment: wastageQty } : undefined,
          },
        });

        const childLot = await tx.stockItem.create({
          data: {
            orgId: session.orgId,
            containerId: source.containerId,
            warehouseId: source.warehouseId,
            locationId: source.locationId,
            parentStockItemId: source.id,
            item: order.outputItem,
            variety: source.variety,
            grade: order.outputGrade,
            uom: source.uom,
            qtyReceived: outputQty,
            qtyAvailable: outputQty,
            perUnitWeightKg: source.perUnitWeightKg,
            lotNo: `${source.lotNo ?? source.id.slice(0, 8)}-RP`,
            packDate: new Date(),
            expiryDate: source.expiryDate,
            bestBeforeDate: source.bestBeforeDate,
            storageCondition: source.storageCondition,
            ripeningState: source.ripeningState,
            qualityStatus: "Released",
          },
        });

        await tx.stockMovement.createMany({
          data: [
            {
              orgId: session.orgId,
              stockItemId: source.id,
              kind: "Grade",
              qty: actualInputQty,
              uom: source.uom,
              reason: `Input consumed by ${order.workOrderNo}`,
              refType: "repacking_work_order",
              refId: order.id,
              createdById: session.userId,
            },
            ...(wastageQty > 0
              ? [{
                  orgId: session.orgId,
                  stockItemId: source.id,
                  kind: "Wastage" as const,
                  qty: wastageQty,
                  uom: source.uom,
                  reason: `Repacking wastage on ${order.workOrderNo}`,
                  refType: "repacking_work_order",
                  refId: order.id,
                  createdById: session.userId,
                }]
              : []),
            {
              orgId: session.orgId,
              stockItemId: childLot.id,
              kind: "Grade",
              qty: outputQty,
              uom: source.uom,
              reason: `Output created by ${order.workOrderNo}`,
              refType: "repacking_work_order",
              refId: order.id,
              createdById: session.userId,
            },
          ],
        });

        const completed = await tx.repackingWorkOrder.update({
          where: { id: order.id },
          data: {
            actualInputQty,
            outputQty,
            wastageQty,
            laborHours: nullableNumber(body.laborHours),
            workerCount: nullableNumber(body.workerCount),
            status: "Completed",
            completedAt: new Date(),
            notes: normalize(body.notes) || order.notes,
          },
        });

        return { completed, childLot };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "completed_repacking_work_order",
        entityType: "repacking_work_order",
        entityId: result.completed.id,
        summary: `Completed repacking work order ${result.completed.workOrderNo}`,
        metadata: { after: result },
      });
      return NextResponse.json({ data: result });
    }

    if (body.kind === "qc-sampling-plan") {
      const existing = await prisma.qcSamplingPlan.findFirst({
        where: { id: normalize(body.id), orgId: session.orgId },
        select: { id: true, planNo: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const plan = await prisma.qcSamplingPlan.update({
        where: { id: existing.id },
        data: {
          defectClass: body.defectClass !== undefined ? normalize(body.defectClass) || null : undefined,
          defectCount: body.defectCount !== undefined ? nullableNumber(body.defectCount) ?? 0 : undefined,
          severity: normalize(body.severity) || undefined,
          photoRef: body.photoRef !== undefined ? normalize(body.photoRef) || null : undefined,
          disposition: normalize(body.disposition) || undefined,
          status: normalize(body.status) || undefined,
        },
      });
      return NextResponse.json({ data: plan });
    }

    if (body.kind === "exception-approval") {
      if (!can(session.role, "warehouse.count.approve") && !can(session.role, "masterdata.approve")) {
        return NextResponse.json({ error: "Approval permission required" }, { status: 403 });
      }
      const existing = await prisma.warehouseExceptionApproval.findFirst({
        where: { id: normalize(body.id), orgId: session.orgId },
        select: { id: true, exceptionType: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const status = normalize(body.status);
      if (status !== "Approved" && status !== "Rejected") {
        return NextResponse.json({ error: "Status must be Approved or Rejected" }, { status: 422 });
      }
      const exception = await prisma.warehouseExceptionApproval.update({
        where: { id: existing.id },
        data: {
          status,
          reviewedById: session.userId,
          reviewedAt: new Date(),
          reviewNotes: normalize(body.reviewNotes) || null,
        },
      });
      await logActivity({
        orgId: session.orgId,
        userId: session.userId,
        action: "reviewed_warehouse_exception",
        entityType: "warehouse_exception_approval",
        entityId: exception.id,
        summary: `${status} ${exception.exceptionType} approval`,
        metadata: { after: exception },
      });
      return NextResponse.json({ data: exception });
    }

    if (body.kind === "supplier-claim") {
      const existing = await prisma.supplierClaim.findFirst({
        where: { id: normalize(body.id), orgId: session.orgId },
        select: { id: true, claimNo: true },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const claim = await prisma.supplierClaim.update({
        where: { id: existing.id },
        data: {
          status: normalize(body.status) || undefined,
          claimAmount: body.claimAmount !== undefined ? nullableNumber(body.claimAmount) : undefined,
          notes: body.notes !== undefined ? normalize(body.notes) || null : undefined,
        },
      });
      return NextResponse.json({ data: claim });
    }

    return NextResponse.json({ error: "Invalid warehouse operation" }, { status: 422 });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof Error && err.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof Error && err.message === "WORK_ORDER_NOT_FOUND") {
    return NextResponse.json({ error: "Repacking work order not found" }, { status: 404 });
  }
  if (err instanceof Error && err.message === "WORK_ORDER_ALREADY_COMPLETED") {
    return NextResponse.json({ error: "Repacking work order is already completed" }, { status: 422 });
  }
  if (err instanceof Error && err.message === "INSUFFICIENT_SOURCE_STOCK") {
    return NextResponse.json({ error: "Actual input quantity exceeds available source lot quantity" }, { status: 422 });
  }
  console.error("[api/warehouse-ops]", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

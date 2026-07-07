import "server-only";

import { Prisma } from "@prisma/client";

import { writeActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/document-sequence";
import { prisma } from "@/lib/prisma";
import type { coldRoomReadingSchema, temperatureTaskActionSchema } from "@/lib/validations/cold-chain";
import type { z } from "zod";

type ColdRoomReadingInput = z.infer<typeof coldRoomReadingSchema>;
type TemperatureTaskActionInput = z.infer<typeof temperatureTaskActionSchema>;

function dec(value: unknown): number | null {
  return value == null ? null : Number(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function getColdChainWorkspace(orgId: string) {
  const [readings, tasks] = await Promise.all([
    prisma.coldRoomReading.findMany({
      where: { orgId },
      orderBy: [{ recordedAt: "desc" }],
      take: 50,
      include: {
        warehouse: { select: { name: true, code: true, temperatureMinC: true, temperatureMaxC: true } },
        location: { select: { code: true, name: true, temperatureMinC: true, temperatureMaxC: true } },
      },
    }),
    prisma.temperatureBreachTask.findMany({
      where: { orgId },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      include: {
        warehouse: { select: { name: true, code: true } },
        location: { select: { code: true, name: true } },
      },
    }),
  ]);

  return {
    summary: {
      readings: readings.length,
      openTasks: tasks.filter((task) => ["Open", "Acknowledged", "Escalated"].includes(task.status)).length,
      criticalTasks: tasks.filter((task) => task.severity === "Critical" && task.status !== "Resolved").length,
      resolvedTasks: tasks.filter((task) => task.status === "Resolved").length,
    },
    readings: readings.map((reading) => ({
      id: reading.id,
      warehouseName: reading.warehouse.name,
      warehouseCode: reading.warehouse.code,
      locationName: reading.location ? `${reading.location.code} - ${reading.location.name}` : null,
      recordedAt: iso(reading.recordedAt)!,
      temperatureC: dec(reading.temperatureC),
      humidityPct: dec(reading.humidityPct),
      source: reading.source,
      notes: reading.notes,
      targetMinC: dec(reading.location?.temperatureMinC ?? reading.warehouse.temperatureMinC),
      targetMaxC: dec(reading.location?.temperatureMaxC ?? reading.warehouse.temperatureMaxC),
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      taskNo: task.taskNo,
      warehouseName: task.warehouse.name,
      locationName: task.location ? `${task.location.code} - ${task.location.name}` : null,
      severity: task.severity,
      status: task.status,
      title: task.title,
      description: task.description,
      targetMinC: dec(task.targetMinC),
      targetMaxC: dec(task.targetMaxC),
      actualTempC: dec(task.actualTempC),
      createdAt: iso(task.createdAt)!,
      resolvedAt: iso(task.resolvedAt),
      resolutionNotes: task.resolutionNotes,
    })),
  };
}

export async function recordColdRoomReading(
  orgId: string,
  userId: string | null,
  input: ColdRoomReadingInput
) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, orgId, deletedAt: null },
    select: { id: true, name: true, temperatureMinC: true, temperatureMaxC: true },
  });
  if (!warehouse) throw new ColdChainError("Warehouse not found", 404);

  const location = input.locationId
    ? await prisma.warehouseLocation.findFirst({
        where: { id: input.locationId, orgId, warehouseId: warehouse.id },
        select: { id: true, code: true, name: true, temperatureMinC: true, temperatureMaxC: true },
      })
    : null;
  if (input.locationId && !location) throw new ColdChainError("Location not found", 404);

  const targetMin = dec(location?.temperatureMinC ?? warehouse.temperatureMinC);
  const targetMax = dec(location?.temperatureMaxC ?? warehouse.temperatureMaxC);
  const actual = Number(input.temperatureC);
  const breached =
    (targetMin != null && actual < targetMin) ||
    (targetMax != null && actual > targetMax);
  const severity =
    targetMin != null && actual < targetMin - 2
      ? "Critical"
      : targetMax != null && actual > targetMax + 2
        ? "Critical"
        : breached
          ? "Warning"
          : "Info";

  return prisma.$transaction(async (tx) => {
    const reading = await tx.coldRoomReading.create({
      data: {
        orgId,
        warehouseId: warehouse.id,
        locationId: location?.id ?? null,
        recordedAt: input.recordedAt,
        temperatureC: input.temperatureC,
        humidityPct: input.humidityPct ?? null,
        source: input.source,
        notes: input.notes ?? null,
        recordedById: userId,
      },
    });

    let task = null;
    if (breached) {
      const taskNo = await nextDocumentNumber(tx, orgId, "temperature-task", "TEMP", 5);
      task = await tx.temperatureBreachTask.create({
        data: {
          orgId,
          taskNo,
          warehouseId: warehouse.id,
          locationId: location?.id ?? null,
          readingId: reading.id,
          severity,
          status: "Open",
          title: `Temperature breach at ${location?.code ?? warehouse.name}`,
          description: `Recorded ${actual}C outside target ${targetMin ?? "-"}C to ${targetMax ?? "-"}C`,
          targetMinC: targetMin,
          targetMaxC: targetMax,
          actualTempC: actual,
        },
      });
    }

    await writeActivity(tx, {
      orgId,
      userId,
      action: breached ? "recorded_temperature_breach" : "recorded_cold_room_reading",
      entityType: "cold_room_reading",
      entityId: reading.id,
      summary: breached
        ? `Temperature breach recorded for ${warehouse.name}`
        : `Cold-room reading recorded for ${warehouse.name}`,
      metadata: { actualTempC: actual, targetMinC: targetMin, targetMaxC: targetMax, taskId: task?.id },
    });

    return { reading, task };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateTemperatureTask(
  orgId: string,
  userId: string | null,
  input: TemperatureTaskActionInput
) {
  const task = await prisma.temperatureBreachTask.findFirst({ where: { id: input.taskId, orgId } });
  if (!task) throw new ColdChainError("Temperature task not found", 404);
  const status =
    input.action === "acknowledge" ? "Acknowledged" : input.action === "escalate" ? "Escalated" : "Resolved";
  if (status === "Resolved" && !input.resolutionNotes) {
    throw new ColdChainError("Resolution notes are required", 422);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.temperatureBreachTask.update({
      where: { id: task.id },
      data: {
        status,
        acknowledgedAt: status === "Acknowledged" ? new Date() : undefined,
        resolvedAt: status === "Resolved" ? new Date() : undefined,
        resolvedById: status === "Resolved" ? userId : undefined,
        resolutionNotes: input.resolutionNotes ?? undefined,
      },
    });
    await writeActivity(tx, {
      orgId,
      userId,
      action: "updated_temperature_breach_task",
      entityType: "temperature_breach_task",
      entityId: task.id,
      summary: `Moved temperature task ${task.taskNo} to ${status}`,
      metadata: { status, resolutionNotes: input.resolutionNotes },
    });
    return updated;
  });
}

export class ColdChainError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

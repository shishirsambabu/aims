import "server-only";

import { prisma } from "@/lib/prisma";

export interface WarehouseRecord {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string | null;
  address: string | null;
  storageType: string | null;
  isColdStorage: boolean;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityTarget: number | null;
  capacityTonnes: number | null;
  coldRoomCount: number | null;
  isActive: boolean;
  containerCount: number;
}

export async function listWarehouses(orgId: string): Promise<WarehouseRecord[]> {
  const rows = await prisma.warehouse.findMany({
    where: { orgId, deletedAt: null },
    orderBy: [{ isActive: "desc" }, { city: "asc" }, { name: "asc" }],
    include: { _count: { select: { containers: true } } },
  });

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    city: w.city,
    state: w.state,
    address: w.address,
    storageType: w.storageType,
    isColdStorage: w.isColdStorage,
    temperatureMinC: w.temperatureMinC == null ? null : Number(w.temperatureMinC),
    temperatureMaxC: w.temperatureMaxC == null ? null : Number(w.temperatureMaxC),
    humidityTarget: w.humidityTarget == null ? null : Number(w.humidityTarget),
    capacityTonnes: w.capacityTonnes == null ? null : Number(w.capacityTonnes),
    coldRoomCount: w.coldRoomCount,
    isActive: w.isActive,
    containerCount: w._count.containers,
  }));
}

export async function getWarehouseOptions(orgId: string) {
  const rows = await prisma.warehouse.findMany({
    where: { orgId, deletedAt: null, isActive: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, city: true },
  });
  return rows;
}

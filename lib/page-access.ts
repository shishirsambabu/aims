import "server-only";

import { notFound } from "next/navigation";

import { canAny, type Capability } from "@/lib/permissions";
import type { Role } from "@/types";

export function requirePageAccess(role: Role, capabilities: Capability[]): void {
  if (!canAny(role, capabilities)) notFound();
}

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function auditLog(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      leadId: input.leadId ?? null,
      metadata: toPrismaJson(input.metadata ?? {}),
    },
  });
}

function toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

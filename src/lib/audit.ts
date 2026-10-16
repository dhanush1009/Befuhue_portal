import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function createAuditLog(
  actorId:    string,
  action:     string,
  targetId:   string,
  targetType: string,
  changes?:   Record<string, { before: unknown; after: unknown }>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId, action, targetId, targetType,
        changes: changes ? (changes as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch {
    console.error('[audit] Failed to write audit log', { actorId, action, targetId });
  }
}

import type { Event } from "@prisma/client";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 50;

export async function listEventsForApplication(
  applicationId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<Event[]> {
  return prisma.event.findMany({
    where: { applicationId },
    orderBy: { emittedAt: "desc" },
    take: limit,
  });
}

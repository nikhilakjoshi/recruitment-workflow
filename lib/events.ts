import type { EventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type EmitEventInput = {
  type: EventType;
  candidateId: string;
  applicationId?: string | null;
  payload: Prisma.InputJsonValue;
  emittedBy: string;
};

// Stub implementation for Chunk 1. Chunk 2 will replace this with the real
// dispatcher that fans out to subscribed workers. For now the row is the
// only side effect.
export async function emitEvent(input: EmitEventInput) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[event-stub] ${input.type}`);
  }
  return prisma.event.create({
    data: {
      type: input.type,
      candidateId: input.candidateId,
      applicationId: input.applicationId ?? null,
      payloadJson: input.payload,
      emittedBy: input.emittedBy,
    },
  });
}

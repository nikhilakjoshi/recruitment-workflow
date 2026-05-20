import type { EventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type EmitEventInput = {
  type: EventType;
  candidateId: string;
  applicationId?: string | null;
  payload: Prisma.InputJsonValue;
  emittedBy: string;
};

// Placeholder dispatcher: persists the event row. Fan-out to subscribed
// workers will be added later — callers must not depend on synchronous
// delivery beyond the row write.
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

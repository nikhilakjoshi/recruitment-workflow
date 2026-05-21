import type { Event, EventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type EmitEventInput = {
  type: EventType;
  candidateId: string;
  applicationId?: string | null;
  payload: Prisma.InputJsonValue;
  emittedBy: string;
};

export async function emitEvent(input: EmitEventInput): Promise<Event> {
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

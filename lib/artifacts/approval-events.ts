import { ArtifactType, EventType } from "@prisma/client";

const APPROVAL_EVENTS: Partial<Record<ArtifactType, EventType>> = {
  [ArtifactType.TAILORED_RESUME]: EventType.RESUME_APPROVED,
  [ArtifactType.COVER_LETTER]: EventType.COVER_LETTER_APPROVED,
  [ArtifactType.RECRUITER_REPLY]: EventType.APPROVAL_GRANTED,
  [ArtifactType.THANK_YOU_EMAIL]: EventType.APPROVAL_GRANTED,
  [ArtifactType.LINKEDIN_REWRITE]: EventType.APPROVAL_GRANTED,
  [ArtifactType.NEGOTIATION_DRAFT]: EventType.APPROVAL_GRANTED,
};

const REJECTION_EVENTS: Partial<Record<ArtifactType, EventType>> = {
  [ArtifactType.TAILORED_RESUME]: EventType.RESUME_REJECTED,
  [ArtifactType.RECRUITER_REPLY]: EventType.APPROVAL_REJECTED,
  [ArtifactType.THANK_YOU_EMAIL]: EventType.APPROVAL_REJECTED,
  [ArtifactType.LINKEDIN_REWRITE]: EventType.APPROVAL_REJECTED,
  [ArtifactType.NEGOTIATION_DRAFT]: EventType.APPROVAL_REJECTED,
};

export function eventForApproval(type: ArtifactType): EventType | null {
  return APPROVAL_EVENTS[type] ?? null;
}

export function eventForRejection(type: ArtifactType): EventType | null {
  return REJECTION_EVENTS[type] ?? null;
}

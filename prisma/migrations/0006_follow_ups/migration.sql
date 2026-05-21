-- FollowUp model — Application Tracker emits these for stale applications.
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FollowUp_acknowledged_createdAt_idx" ON "FollowUp"("acknowledged", "createdAt");

ALTER TABLE "FollowUp"
  ADD CONSTRAINT "FollowUp_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

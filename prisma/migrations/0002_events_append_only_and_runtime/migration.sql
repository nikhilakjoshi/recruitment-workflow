-- CreateEnum
CREATE TYPE "EventConsumptionStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- DropColumn (chunk-1 vestigial: dispatcher uses EventConsumption side-table)
ALTER TABLE "Event" DROP COLUMN "consumedByJson";

-- CreateTable
CREATE TABLE "EventConsumption" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "status" "EventConsumptionStatus" NOT NULL,
    "errorMessage" TEXT,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,

    CONSTRAINT "EventConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventConsumption_eventId_workerName_key" ON "EventConsumption"("eventId", "workerName");

-- CreateIndex
CREATE INDEX "EventConsumption_workerName_status_idx" ON "EventConsumption"("workerName", "status");

-- AddForeignKey
ALTER TABLE "EventConsumption" ADD CONSTRAINT "EventConsumption_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "LLMCall" (
    "id" TEXT NOT NULL,
    "worker" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "applicationId" TEXT,
    "eventId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "LLMCall_pkey" PRIMARY KEY ("id")
);

-- Append-only invariant on Event: PL/pgSQL trigger raises on UPDATE/DELETE.
-- Surfaced as a regular Postgres error so Prisma propagates it to callers.
CREATE OR REPLACE FUNCTION events_no_mutate() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'events table is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Event_no_update"
BEFORE UPDATE ON "Event"
FOR EACH ROW EXECUTE FUNCTION events_no_mutate();

CREATE TRIGGER "Event_no_delete"
BEFORE DELETE ON "Event"
FOR EACH ROW EXECUTE FUNCTION events_no_mutate();

-- Opportunity ranking — chunk 7 Job Alert Aggregator writes these.
ALTER TABLE "Opportunity"
  ADD COLUMN "rankScore" INTEGER,
  ADD COLUMN "rankReason" TEXT;

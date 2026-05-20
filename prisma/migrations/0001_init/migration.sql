-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "RemotePolicy" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'ANY');

-- CreateEnum
CREATE TYPE "OpportunitySource" AS ENUM ('LINKEDIN', 'INDEED', 'WELLFOUND', 'DIRECT', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationState" AS ENUM ('DISCOVERED', 'SHORTLISTED', 'EVALUATED', 'TAILORING', 'APPROVED', 'SUBMITTED', 'RECRUITER_ENGAGED', 'INTERVIEWING', 'NEGOTIATING', 'REJECTED', 'ACCEPTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('EVALUATION', 'TAILORED_RESUME', 'COVER_LETTER', 'COMPANY_RESEARCH', 'INTERVIEW_PREP', 'STAR_LIBRARY', 'RECRUITER_REPLY', 'THANK_YOU_EMAIL', 'LINKEDIN_REWRITE', 'NEGOTIATION_DRAFT');

-- CreateEnum
CREATE TYPE "ArtifactState" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REGENERATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('PHONE_SCREEN', 'TECHNICAL_SCREEN', 'BEHAVIORAL', 'PANEL', 'ONSITE_LOOP', 'FINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CANDIDATE_CREATED', 'CANDIDATE_PROFILE_UPDATED', 'SKILL_ADDED', 'TARGET_ROLE_UPDATED', 'JOB_DISCOVERED', 'JOB_RANKED', 'JOB_SHORTLISTED', 'JOB_DISMISSED', 'APPLICATION_CREATED', 'APPLICATION_STATE_CHANGED', 'APPLICATION_SUBMITTED', 'FOLLOW_UP_SCHEDULED', 'REJECTION_RECEIVED', 'OFFER_RECEIVED', 'EVALUATION_GENERATED', 'RESUME_GENERATED', 'RESUME_APPROVAL_REQUESTED', 'RESUME_APPROVED', 'RESUME_REJECTED', 'COVER_LETTER_GENERATED', 'COVER_LETTER_APPROVED', 'ARTIFACT_EDITED', 'ARTIFACT_ARCHIVED', 'RECRUITER_REPLY_DETECTED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_PREP_GENERATED', 'COMPANY_RESEARCH_GENERATED', 'INTERVIEW_COMPLETED', 'APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'APPROVAL_REJECTED', 'OUTBOUND_ACTION_BLOCKED', 'CONVERSION_PATTERN_DETECTED', 'SKILL_GAP_TREND_DETECTED', 'NARRATIVE_THEME_DETECTED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('CONVERSION_PATTERN', 'SKILL_GAP', 'NARRATIVE_THEME', 'COMP_TREND', 'RECRUITER_RESPONSE_PATTERN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCV" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "structuredJson" JSONB NOT NULL,
    "gcsUri" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePreference" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "targetRoles" TEXT[],
    "targetIndustries" TEXT[],
    "targetCompanies" TEXT[],
    "excludedCompanies" TEXT[],
    "compMin" INTEGER,
    "compMax" INTEGER,
    "compCurrency" TEXT NOT NULL DEFAULT 'USD',
    "geoLocations" TEXT[],
    "remotePolicy" "RemotePolicy" NOT NULL DEFAULT 'ANY',
    "workAuth" TEXT,
    "careerGoals" TEXT,
    "compStructured" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourcePlatform" "OpportunitySource" NOT NULL,
    "jdText" TEXT NOT NULL,
    "jdStructuredJson" JSONB,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(1536),

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "state" "ApplicationState" NOT NULL DEFAULT 'DISCOVERED',
    "targetRoleSnapshot" JSONB NOT NULL,
    "shortlistedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "state" "ArtifactState" NOT NULL DEFAULT 'DRAFT',
    "contentJson" JSONB NOT NULL,
    "contentText" TEXT,
    "gcsUri" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "generatedByWorker" TEXT NOT NULL,
    "generationContext" JSONB NOT NULL,
    "embedding" vector(1536),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recruiter" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "linkedinUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recruiter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "recruiterId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "interviewType" "InterviewType" NOT NULL,
    "preparationNotes" TEXT,
    "sessionNotes" TEXT,
    "outcomeJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "emittedBy" TEXT NOT NULL,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedByJson" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" "InsightType" NOT NULL,
    "contentJson" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "supersededBy" TEXT,
    "supersededAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_userId_key" ON "Candidate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterCV_candidateId_key" ON "MasterCV"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePreference_candidateId_key" ON "RolePreference"("candidateId");

-- CreateIndex
CREATE INDEX "Application_state_idx" ON "Application"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Application_candidateId_opportunityId_key" ON "Application"("candidateId", "opportunityId");

-- CreateIndex
CREATE INDEX "Artifact_applicationId_type_versionNumber_idx" ON "Artifact"("applicationId", "type", "versionNumber");

-- CreateIndex
CREATE INDEX "Event_type_emittedAt_idx" ON "Event"("type", "emittedAt");

-- CreateIndex
CREATE INDEX "Event_applicationId_emittedAt_idx" ON "Event"("applicationId", "emittedAt");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCV" ADD CONSTRAINT "MasterCV_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePreference" ADD CONSTRAINT "RolePreference_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "Artifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recruiter" ADD CONSTRAINT "Recruiter_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Single-tenant invariant: only one Candidate row allowed at the DB level.
-- Postgres CHECK constraints cannot contain subqueries, so we use a unique
-- expression index over a constant — any second insert fails the unique
-- constraint. Drop this index manually if you ever need to seed a second
-- Candidate for testing.
CREATE UNIQUE INDEX "Candidate_singleton" ON "Candidate" ((true));

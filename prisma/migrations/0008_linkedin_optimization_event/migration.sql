-- AlterEnum: add LINKEDIN_OPTIMIZATION_REQUESTED next to INTERVIEW_COMPLETED
-- so it sorts with the other interview / recruiter / preparation events.
ALTER TYPE "EventType" ADD VALUE 'LINKEDIN_OPTIMIZATION_REQUESTED' AFTER 'INTERVIEW_COMPLETED';

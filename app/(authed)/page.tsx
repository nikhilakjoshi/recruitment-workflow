import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ActiveApplicationsSection } from "@/components/dashboard/active-applications";
import { PendingApprovalsSection } from "@/components/dashboard/pending-approvals";
import { RecruiterActivitySection } from "@/components/dashboard/recruiter-activity";
import { UpcomingInterviewsSection } from "@/components/dashboard/upcoming-interviews";
import { OpportunityDigestSection } from "@/components/dashboard/opportunity-digest";
import { FollowUpAlertsSection } from "@/components/dashboard/follow-up-alerts";
import { StrategicInsightsSection } from "@/components/dashboard/strategic-insights";
import { BackgroundWorkersPanel } from "@/components/dashboard/background-workers";
import { OpsActivityPanel } from "@/components/dashboard/ops-activity";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId) redirect("/signin");

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId },
    select: { id: true },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ActiveApplicationsSection candidateId={candidate.id} />
      <PendingApprovalsSection candidateId={candidate.id} />
      <RecruiterActivitySection candidateId={candidate.id} />
      <UpcomingInterviewsSection candidateId={candidate.id} />
      <OpportunityDigestSection />
      <FollowUpAlertsSection candidateId={candidate.id} />
      <BackgroundWorkersPanel />
      <div className="lg:col-span-2">
        <OpsActivityPanel />
      </div>
      <div className="lg:col-span-2">
        <StrategicInsightsSection candidateId={candidate.id} />
      </div>
    </div>
  );
}

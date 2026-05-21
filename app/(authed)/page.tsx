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
      <RecruiterActivitySection />
      <UpcomingInterviewsSection />
      <OpportunityDigestSection />
      <FollowUpAlertsSection candidateId={candidate.id} />
      <div className="lg:col-span-2">
        <StrategicInsightsSection candidateId={candidate.id} />
      </div>
    </div>
  );
}

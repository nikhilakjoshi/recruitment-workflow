import { EventType } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { RecruiterActivity } from "@/components/dashboard/recruiter-activity";
import { UpcomingInterviews } from "@/components/dashboard/upcoming-interviews";

export default async function DashboardPage() {
  const session = await getSession();
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId! },
    select: { id: true },
  });

  const [recruiterEvents, upcomingInterviews] = await Promise.all([
    prisma.event.findMany({
      where: {
        candidateId: candidate.id,
        type: EventType.RECRUITER_REPLY_DETECTED,
      },
      orderBy: { emittedAt: "desc" },
      take: 5,
      include: {
        application: {
          select: {
            id: true,
            opportunity: { select: { title: true, company: true } },
          },
        },
      },
    }),
    prisma.interview.findMany({
      where: {
        application: { candidateId: candidate.id },
        scheduledFor: { gte: new Date() },
      },
      orderBy: { scheduledFor: "asc" },
      take: 5,
      include: {
        application: {
          select: {
            id: true,
            opportunity: { select: { title: true, company: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Recruiter activity + upcoming interviews. Insights live at{" "}
          <a href="/insights" className="text-primary hover:underline">
            /insights
          </a>
          .
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingInterviews interviews={upcomingInterviews} />
        <RecruiterActivity events={recruiterEvents} />
      </div>
    </div>
  );
}

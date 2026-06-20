import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { DashboardSection } from "./section-card";

export async function UpcomingInterviewsSection({ candidateId }: { candidateId: string }) {
  const interviews = await prisma.interview.findMany({
    where: {
      application: { candidateId },
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
  });

  return (
    <DashboardSection
      title="Upcoming Interviews"
      description="Scheduled interviews and prep readiness"
    >
      {interviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No upcoming interviews. Schedule an interview on any application to
          see it here with prep status.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {interviews.map((iv) => (
            <li key={iv.id} className="flex items-start gap-3 py-2">
              <div className="flex flex-1 flex-col">
                <Link
                  href={`/applications/${iv.application.id}/interviews/${iv.id}`}
                  className="text-sm hover:underline"
                >
                  {iv.application.opportunity.company} —{" "}
                  {iv.application.opportunity.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {new Date(iv.scheduledFor).toLocaleString("en-US")}
                  {iv.durationMinutes ? ` · ${iv.durationMinutes} min` : ""}
                </span>
              </div>
              <Badge variant="outline">{iv.interviewType}</Badge>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

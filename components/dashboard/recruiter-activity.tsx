import Link from "next/link";
import { EventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DashboardSection } from "./section-card";

export async function RecruiterActivitySection({ candidateId }: { candidateId: string }) {
  const events = await prisma.event.findMany({
    where: {
      candidateId,
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
  });

  return (
    <DashboardSection
      title="Recruiter Activity"
      description="Recent inbound from recruiters"
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recruiter activity yet. Log a recruiter reply on any application
          and it&apos;ll surface here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 py-2">
              <span className="text-sm">
                {e.application ? (
                  <Link
                    href={`/applications/${e.application.id}`}
                    className="hover:underline"
                  >
                    {e.application.opportunity.company} —{" "}
                    {e.application.opportunity.title}
                  </Link>
                ) : (
                  "(unattached)"
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(e.emittedAt).toLocaleString("en-US")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { DashboardSection } from "./section-card";
import { FollowUpAcknowledgeButton } from "./follow-up-acknowledge-button";

export async function FollowUpAlertsSection({ candidateId }: { candidateId: string }) {
  const followUps = await prisma.followUp.findMany({
    where: {
      acknowledged: false,
      application: { candidateId },
    },
    include: {
      application: {
        include: { opportunity: { select: { title: true, company: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  return (
    <DashboardSection
      title="Follow-Up Alerts"
      description="Applications that need a nudge"
    >
      {followUps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No outstanding follow-ups. The Application Tracker runs daily at 9am UTC.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {followUps.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 rounded-md px-2 py-2"
            >
              <div className="flex flex-col">
                <Link
                  href={`/applications/${f.applicationId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {f.application.opportunity.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {f.application.opportunity.company} · {f.reason}
                </span>
                <span className="mt-1 text-xs text-foreground/80">
                  Next: {f.suggestedAction}
                </span>
              </div>
              <FollowUpAcknowledgeButton followUpId={f.id} />
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

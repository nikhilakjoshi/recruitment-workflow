import Link from "next/link";
import { ArtifactState } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { DashboardSection } from "./section-card";

export async function PendingApprovalsSection({ candidateId }: { candidateId: string }) {
  const pending = await prisma.artifact.findMany({
    where: {
      state: ArtifactState.PENDING_REVIEW,
      application: { candidateId },
    },
    include: {
      application: {
        include: { opportunity: { select: { title: true, company: true } } },
      },
    },
    orderBy: { generatedAt: "desc" },
    take: 10,
  });

  return (
    <DashboardSection
      title="Pending Approvals"
      description="Drafts waiting on your review"
    >
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((a) => (
            <li key={a.id}>
              <Link
                href={`/applications/${a.applicationId}?tab=artifacts`}
                className="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {a.application.opportunity.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.application.opportunity.company} ·{" "}
                    {a.generatedAt.toLocaleString()}
                  </span>
                </div>
                <Badge>{a.type}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

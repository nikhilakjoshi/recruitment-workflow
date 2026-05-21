import Link from "next/link";
import { ApplicationState } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { DashboardSection } from "./section-card";

const TERMINAL = [
  ApplicationState.ARCHIVED,
  ApplicationState.REJECTED,
  ApplicationState.ACCEPTED,
];

export async function ActiveApplicationsSection({ candidateId }: { candidateId: string }) {
  const applications = await prisma.application.findMany({
    where: { candidateId, state: { notIn: TERMINAL } },
    include: { opportunity: { select: { title: true, company: true } } },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return (
    <DashboardSection
      title="Active Applications"
      description="Open pursuits sorted by most recent activity"
    >
      {applications.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active applications. Shortlist an opportunity to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {applications.map((a) => (
            <li key={a.id}>
              <Link
                href={`/applications/${a.id}`}
                className="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{a.opportunity.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.opportunity.company} · {a.updatedAt.toLocaleDateString()}
                  </span>
                </div>
                <Badge>{a.state}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

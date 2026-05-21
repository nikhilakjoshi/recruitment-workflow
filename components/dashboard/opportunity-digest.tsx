import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { DashboardSection } from "./section-card";

export async function OpportunityDigestSection() {
  // Single-tenant: every Opportunity is in scope. Show the top-ranked
  // openings that haven't been dismissed yet.
  const opportunities = await prisma.opportunity.findMany({
    where: { dismissed: false, rankScore: { not: null } },
    orderBy: [{ rankScore: "desc" }, { discoveredAt: "desc" }],
    take: 10,
  });

  return (
    <DashboardSection
      title="Opportunity Digest"
      description="Top-ranked picks from the latest aggregator run"
      action={
        <Link
          href="/opportunities"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          See all
        </Link>
      }
    >
      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing ranked yet. The Job Alert Aggregator runs daily at 8am UTC.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {opportunities.map((o) => (
            <li
              key={o.id}
              className="flex items-start justify-between gap-3 rounded-md px-2 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{o.title}</span>
                <span className="text-xs text-muted-foreground">
                  {o.company} · {o.sourcePlatform}
                </span>
                {o.rankReason ? (
                  <span className="mt-1 text-xs text-muted-foreground/80">
                    {o.rankReason}
                  </span>
                ) : null}
              </div>
              <Badge>{o.rankScore}</Badge>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

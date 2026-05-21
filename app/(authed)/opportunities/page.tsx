import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import { PasteJdModal } from "@/components/opportunities/paste-jd-modal";

export default async function OpportunitiesPage() {
  const session = await getSession();
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId! },
    select: { id: true },
  });

  const opportunities = await prisma.opportunity.findMany({
    orderBy: { discoveredAt: "desc" },
    include: {
      applications: {
        where: { candidateId: candidate.id },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            All discovered roles. Shortlist to start an application; dismiss to
            archive.
          </p>
        </div>
        <PasteJdModal />
      </header>
      <OpportunityList opportunities={opportunities} />
    </div>
  );
}

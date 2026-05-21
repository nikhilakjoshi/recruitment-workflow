import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ApplicationList } from "@/components/applications/application-list";

export default async function ApplicationsPage() {
  const session = await getSession();
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId! },
    select: { id: true },
  });

  const applications = await prisma.application.findMany({
    where: { candidateId: candidate.id },
    orderBy: { updatedAt: "desc" },
    include: { opportunity: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Everything you&apos;ve shortlisted, in state order. Click in to open the
          workspace.
        </p>
      </header>
      <ApplicationList applications={applications} />
    </div>
  );
}

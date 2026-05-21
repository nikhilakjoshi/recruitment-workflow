import { InsightType } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Funnel } from "@/components/insights/funnel";
import { RoleFamilyConversion } from "@/components/insights/role-family-conversion";
import { NarrativeThemes } from "@/components/insights/narrative-themes";
import { computeFunnel } from "@/lib/insights/funnel";
import { computeRoleFamilyConversion } from "@/lib/insights/role-family";

export default async function InsightsPage() {
  const session = await getSession();
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId! },
    select: { id: true },
  });

  const [applications, latestThemes] = await Promise.all([
    prisma.application.findMany({
      where: { candidateId: candidate.id },
      select: {
        state: true,
        shortlistedAt: true,
        submittedAt: true,
        targetRoleSnapshot: true,
      },
    }),
    prisma.insight.findFirst({
      where: {
        candidateId: candidate.id,
        type: InsightType.NARRATIVE_THEME,
      },
      orderBy: { generatedAt: "desc" },
    }),
  ]);

  const funnel = computeFunnel(applications);
  const roleFamily = computeRoleFamilyConversion(applications);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Funnel, conversion by role family, and AI-derived narrative themes
          mined from approved tailored resumes.
        </p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-medium">Funnel</h2>
        <Funnel rows={funnel} />
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-medium">Per-role-family conversion</h2>
        <RoleFamilyConversion rows={roleFamily} />
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-medium">Narrative themes</h2>
        <NarrativeThemes insight={latestThemes} />
      </Card>
    </div>
  );
}

import { InsightType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DashboardSection } from "./section-card";

type DigestShape = {
  paragraph?: string;
  highlights?: string[];
  weekStart?: string;
  weekEnd?: string;
};

function readDigest(json: Prisma.JsonValue): DigestShape {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return json as DigestShape;
  }
  return {};
}

export async function StrategicInsightsSection({ candidateId }: { candidateId: string }) {
  const latest = await prisma.insight.findFirst({
    where: { candidateId, type: InsightType.WEEKLY_DIGEST },
    orderBy: { generatedAt: "desc" },
  });

  const digest = latest ? readDigest(latest.contentJson) : null;

  return (
    <DashboardSection
      title="Strategic Insights"
      description="Latest weekly digest + emerging patterns"
    >
      {!latest || !digest ? (
        <p className="text-sm text-muted-foreground">
          No digest yet. The Weekly Digest runs Sundays at 9am UTC.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{digest.paragraph ?? "(no narrative)"}</p>
          {digest.highlights && digest.highlights.length > 0 ? (
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {digest.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
          {digest.weekStart && digest.weekEnd ? (
            <p className="text-xs text-muted-foreground/80">
              Week of {new Date(digest.weekStart).toLocaleDateString()} →{" "}
              {new Date(digest.weekEnd).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      )}
    </DashboardSection>
  );
}

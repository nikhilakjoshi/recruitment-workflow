import { notFound } from "next/navigation";
import Link from "next/link";
import { ArtifactType } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrepTab } from "@/components/interviews/prep-tab";
import { NotesTab } from "@/components/interviews/notes-tab";
import { OutcomeTab } from "@/components/interviews/outcome-tab";
import type { InterviewOutcome } from "./_actions";

type StoredOutcome = {
  outcome?: InterviewOutcome;
  reflection?: string;
  recordedAt?: string;
};

function parseOutcome(json: unknown): StoredOutcome | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const outcome = typeof obj.outcome === "string" ? (obj.outcome as InterviewOutcome) : undefined;
  return {
    outcome,
    reflection: typeof obj.reflection === "string" ? obj.reflection : undefined,
    recordedAt: typeof obj.recordedAt === "string" ? obj.recordedAt : undefined,
  };
}

export default async function InterviewWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; interviewId: string }>;
}) {
  const { id: applicationId, interviewId } = await params;
  const session = await getSession();
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId! },
    select: { id: true },
  });

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      recruiter: true,
      application: { select: { id: true, candidateId: true, opportunity: true } },
    },
  });
  if (
    !interview ||
    interview.applicationId !== applicationId ||
    interview.application.candidateId !== candidate.id
  ) {
    notFound();
  }

  const [prep, companyResearch] = await Promise.all([
    prisma.artifact.findFirst({
      where: { applicationId, type: ArtifactType.INTERVIEW_PREP },
      orderBy: { versionNumber: "desc" },
    }),
    prisma.artifact.findFirst({
      where: { applicationId, type: ArtifactType.COMPANY_RESEARCH },
      orderBy: { versionNumber: "desc" },
    }),
  ]);

  const existingOutcome = parseOutcome(interview.outcomeJson);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/applications/${applicationId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to {interview.application.opportunity.company}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">
              {interview.application.opportunity.title} — Interview
            </h1>
            <p className="text-sm text-muted-foreground">
              {new Date(interview.scheduledFor).toLocaleString()}
              {interview.recruiter ? ` · ${interview.recruiter.name}` : ""}
              {interview.durationMinutes
                ? ` · ${interview.durationMinutes} min`
                : ""}
            </p>
          </div>
          <Badge>{interview.interviewType}</Badge>
        </div>
      </header>

      <Card className="p-6">
        <Tabs defaultValue="prep" className="gap-4">
          <TabsList>
            <TabsTrigger value="prep">Prep</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="outcome">Outcome</TabsTrigger>
          </TabsList>
          <TabsContent value="prep">
            <PrepTab
              applicationId={applicationId}
              prep={prep}
              companyResearch={companyResearch}
            />
          </TabsContent>
          <TabsContent value="notes">
            <NotesTab
              interviewId={interview.id}
              initialNotes={interview.sessionNotes ?? ""}
            />
          </TabsContent>
          <TabsContent value="outcome">
            <OutcomeTab
              interviewId={interview.id}
              applicationId={applicationId}
              existing={existingOutcome}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

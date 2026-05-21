import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StateTransitionButtons } from "@/components/applications/state-transition-buttons";
import { OverviewTab } from "@/components/applications/overview-tab";
import { ArtifactsTab } from "@/components/applications/artifacts-tab";
import { ActivityTab } from "@/components/applications/activity-tab";
import { InterviewsTab } from "@/components/applications/interviews-tab";
import { listEventsForApplication } from "@/lib/events/list-for-application";

export default async function ApplicationWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId: session.userId! },
    select: { id: true },
  });

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      opportunity: true,
      artifacts: { orderBy: [{ type: "asc" }, { versionNumber: "desc" }] },
    },
  });
  if (!application || application.candidateId !== candidate.id) {
    notFound();
  }

  const events = await listEventsForApplication(application.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{application.opportunity.title}</h1>
            <p className="text-sm text-muted-foreground">
              {application.opportunity.company} · {application.opportunity.sourcePlatform}
            </p>
          </div>
          <Badge className="text-sm">{application.state}</Badge>
        </div>
        <StateTransitionButtons
          applicationId={application.id}
          currentState={application.state}
        />
      </header>

      <Card className="p-6">
        <Tabs defaultValue="overview" className="gap-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="artifacts">
              Artifacts {application.artifacts.length > 0 ? `(${application.artifacts.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="interviews">Interviews</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab application={application} opportunity={application.opportunity} />
          </TabsContent>
          <TabsContent value="artifacts">
            <ArtifactsTab
              applicationId={application.id}
              artifacts={application.artifacts}
            />
          </TabsContent>
          <TabsContent value="interviews">
            <InterviewsTab />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab events={events} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

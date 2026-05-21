import Link from "next/link";
import type { Interview } from "@prisma/client";
import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

export type UpcomingInterview = Interview & {
  application: {
    id: string;
    opportunity: { title: string; company: string };
  };
};

type Props = {
  interviews: UpcomingInterview[];
};

export function UpcomingInterviews({ interviews }: Props) {
  if (interviews.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={CalendarClock}
          title="No upcoming interviews"
          description="Schedule an interview on any application to see it here with prep status."
        />
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3 p-6">
      <h2 className="text-lg font-medium">Upcoming interviews</h2>
      <ul className="flex flex-col divide-y divide-border">
        {interviews.map((iv) => (
          <li key={iv.id} className="flex items-start gap-3 py-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-1 flex-col">
              <Link
                href={`/applications/${iv.application.id}/interviews/${iv.id}`}
                className="text-sm hover:underline"
              >
                {iv.application.opportunity.company} —{" "}
                {iv.application.opportunity.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {new Date(iv.scheduledFor).toLocaleString()}
                {iv.durationMinutes ? ` · ${iv.durationMinutes} min` : ""}
              </span>
            </div>
            <Badge variant="outline">{iv.interviewType}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

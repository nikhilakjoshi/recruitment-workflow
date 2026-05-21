import Link from "next/link";
import type { Event } from "@prisma/client";
import { MailOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export type RecruiterActivityEvent = Event & {
  application: {
    id: string;
    opportunity: { title: string; company: string };
  } | null;
};

type Props = {
  events: RecruiterActivityEvent[];
};

export function RecruiterActivity({ events }: Props) {
  if (events.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={MailOpen}
          title="No recruiter activity"
          description="Log a recruiter reply on any application and it'll surface here."
        />
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3 p-6">
      <h2 className="text-lg font-medium">Recent recruiter activity</h2>
      <ul className="flex flex-col divide-y divide-border">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 py-2">
            <MailOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-1 flex-col">
              <span className="text-sm">
                {e.application ? (
                  <Link
                    href={`/applications/${e.application.id}`}
                    className="hover:underline"
                  >
                    {e.application.opportunity.company} —{" "}
                    {e.application.opportunity.title}
                  </Link>
                ) : (
                  "(unattached)"
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(e.emittedAt).toLocaleString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

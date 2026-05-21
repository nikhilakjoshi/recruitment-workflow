import Link from "next/link";
import type { Application, Opportunity } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type Props = {
  applications: (Application & { opportunity: Opportunity })[];
};

export function ApplicationList({ applications }: Props) {
  if (applications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No applications yet. Visit Opportunities and shortlist a role.
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {applications.map((app) => (
        <Link
          key={app.id}
          href={`/applications/${app.id}`}
          className="group rounded-xl transition-colors hover:bg-accent/30"
        >
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium group-hover:underline">
                  {app.opportunity.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {app.opportunity.company}
                </span>
              </div>
              <Badge>{app.state}</Badge>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

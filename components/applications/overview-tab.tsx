"use client";

import * as React from "react";
import type { Application, Opportunity } from "@prisma/client";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

type Props = {
  application: Application;
  opportunity: Opportunity;
};

export function OverviewTab({ application, opportunity }: Props) {
  const [open, setOpen] = React.useState(false);
  const snapshot = application.targetRoleSnapshot as Record<string, unknown> | null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Job description</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
          {open ? "Hide JD" : "Show JD"}
        </button>
        {open ? (
          <pre className="max-h-96 overflow-auto rounded-lg border border-input bg-muted/30 p-3 text-xs whitespace-pre-wrap">
            {opportunity.jdText}
          </pre>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <KeyDate label="Discovered" value={opportunity.discoveredAt} />
        <KeyDate label="Created" value={application.createdAt} />
        <KeyDate label="Shortlisted" value={application.shortlistedAt} />
        <KeyDate label="Submitted" value={application.submittedAt} />
        <KeyDate label="Rejected" value={application.rejectedAt} />
        <KeyDate label="Accepted" value={application.acceptedAt} />
        <KeyDate label="Archived" value={application.archivedAt} />
      </section>

      {snapshot && Object.keys(snapshot).length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Role preference snapshot</h3>
          <pre className="max-h-64 overflow-auto rounded-lg border border-input bg-muted/30 p-3 text-xs">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

function KeyDate({ label, value }: { label: string; value: Date | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ? new Date(value).toLocaleString() : "—"}</span>
    </div>
  );
}

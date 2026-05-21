"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Application, Opportunity } from "@prisma/client";
import { ExternalLinkIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import {
  dismissOpportunityAction,
  shortlistOpportunityAction,
} from "@/app/(authed)/opportunities/_actions";

type Props = {
  opportunity: Opportunity & { applications: Application[] };
};

export function OpportunityRow({ opportunity }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const application = opportunity.applications[0] ?? null;

  function renderStatus() {
    if (application) return <Badge>{application.state}</Badge>;
    if (opportunity.dismissed) return <Badge variant="secondary">Dismissed</Badge>;
    return <span className="text-muted-foreground">Discovered</span>;
  }

  function renderActions() {
    if (application) {
      return (
        <Link
          href={`/applications/${application.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open
        </Link>
      );
    }
    if (opportunity.dismissed) return null;
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" disabled={pending} onClick={shortlist}>
          Shortlist
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    );
  }

  async function shortlist() {
    setPending(true);
    try {
      const res = await shortlistOpportunityAction(opportunity.id);
      if (!res.ok) toastError(res.error);
      else {
        toastSuccess("Shortlisted — opening application…");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function dismiss() {
    setPending(true);
    try {
      const res = await dismissOpportunityAction(opportunity.id);
      if (!res.ok) toastError(res.error);
      else {
        toastSuccess("Dismissed");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <TableRow data-dismissed={opportunity.dismissed}>
      <TableCell className="font-medium">
        {opportunity.title}
        {opportunity.sourceUrl ? (
          <a
            href={opportunity.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-2 inline-flex items-center text-muted-foreground hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
      </TableCell>
      <TableCell>{opportunity.company}</TableCell>
      <TableCell>
        <Badge variant="outline">{opportunity.sourcePlatform}</Badge>
      </TableCell>
      <TableCell>{renderStatus()}</TableCell>
      <TableCell className="text-right">{renderActions()}</TableCell>
    </TableRow>
  );
}

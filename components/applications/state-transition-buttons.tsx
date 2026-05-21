"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ApplicationState } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { TRANSITIONS } from "@/lib/state-machine/transitions-table";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { transitionApplicationAction } from "@/app/(authed)/applications/[id]/_actions";

type Props = {
  applicationId: string;
  currentState: ApplicationState;
};

export function StateTransitionButtons({ applicationId, currentState }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const validNextStates = TRANSITIONS[currentState];

  if (validNextStates.length === 0) {
    return null;
  }

  async function go(next: ApplicationState) {
    setPending(true);
    try {
      const res = await transitionApplicationAction(applicationId, next);
      if (!res.ok) toastError(res.error);
      else {
        toastSuccess(`Moved to ${next}`);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="state-transition-buttons">
      <span className="text-xs text-muted-foreground">Move to:</span>
      {validNextStates.map((next) => (
        <Button
          key={next}
          size="sm"
          variant={next === ApplicationState.ARCHIVED ? "outline" : "default"}
          disabled={pending}
          onClick={() => go(next)}
        >
          {next}
        </Button>
      ))}
    </div>
  );
}

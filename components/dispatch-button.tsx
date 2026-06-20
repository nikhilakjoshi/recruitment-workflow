"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlayIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { dispatchEventsAction } from "@/app/(authed)/_actions/workers";

export function DispatchButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await dispatchEventsAction();
      if (!res.ok) {
        toastError(res.error);
        return;
      }
      toastSuccess(`Processed ${res.processed}, errors ${res.errors}`);
      router.refresh();
    });
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={pending}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
            <span className="hidden md:inline">Process events</span>
          </Button>
        }
      />
      <TooltipContent>
        Drains the pending event queue once. Run after every shortlist, approve, or recruiter-reply action.
      </TooltipContent>
    </Tooltip>
  );
}

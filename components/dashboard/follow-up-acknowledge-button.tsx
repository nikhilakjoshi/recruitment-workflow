"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { acknowledgeFollowUpAction } from "@/app/(authed)/_actions";

export function FollowUpAcknowledgeButton({ followUpId }: { followUpId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await acknowledgeFollowUpAction(followUpId);
          if (r.ok) toastSuccess("Acknowledged");
          else toastError(r.error);
        });
      }}
    >
      {pending ? "..." : "Acknowledge"}
    </Button>
  );
}

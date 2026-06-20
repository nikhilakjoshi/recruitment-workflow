"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { clearWorkspaceAction } from "@/app/(authed)/_actions/workers";

export function ClearWorkspaceButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const res = await clearWorkspaceAction();
      if (!res.ok) {
        toastError(res.error);
        return;
      }
      toastSuccess(
        `Cleared ${res.deletedApplications} application(s), ${res.deletedOpportunities} opportunity(s), ${res.clearedMasterCv ? "removed master CV" : "no master CV to remove"}`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <TrashIcon />
            Clear workspace
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clear the entire workspace?</DialogTitle>
          <DialogDescription>
            Deletes every application, opportunity, artifact (cascades), and the uploaded
            Master CV. Cannot be undone. Use this when a new stakeholder is starting fresh
            with their own resume.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "Clearing…" : "Clear everything"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

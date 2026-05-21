"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InterviewType } from "@prisma/client";
import { CalendarPlusIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { scheduleInterviewAction } from "@/app/(authed)/applications/[id]/_actions";
import type { RecruiterOption } from "./recruiter-reply-form";

const INTERVIEW_TYPES: InterviewType[] = [
  InterviewType.PHONE_SCREEN,
  InterviewType.TECHNICAL_SCREEN,
  InterviewType.BEHAVIORAL,
  InterviewType.PANEL,
  InterviewType.ONSITE_LOOP,
  InterviewType.FINAL,
  InterviewType.OTHER,
];

type Props = {
  applicationId: string;
  recruiters: RecruiterOption[];
};

function defaultDatetime(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 24);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleInterviewForm({ applicationId, recruiters }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [recruiterId, setRecruiterId] = React.useState<string>(
    recruiters[0]?.id ?? "",
  );
  const [interviewType, setInterviewType] = React.useState<InterviewType>(
    InterviewType.PHONE_SCREEN,
  );
  const [scheduledFor, setScheduledFor] = React.useState(defaultDatetime());
  const [durationMinutes, setDurationMinutes] = React.useState(60);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await scheduleInterviewAction(applicationId, {
        recruiterId: recruiterId || null,
        interviewType,
        scheduledFor,
        durationMinutes,
      });
      if (!res.ok) {
        toastError(res.error);
        return;
      }
      toastSuccess("Interview scheduled — prep generating");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <CalendarPlusIcon /> Schedule interview
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>
            Creates an Interview row and emits INTERVIEW_SCHEDULED. Triggers
            Interview Prep + Company Research workers.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sif-recruiter">Recruiter (optional)</Label>
              <select
                id="sif-recruiter"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                value={recruiterId}
                onChange={(e) => setRecruiterId(e.target.value)}
              >
                <option value="">— none —</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sif-type">Interview type</Label>
              <select
                id="sif-type"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                value={interviewType}
                onChange={(e) =>
                  setInterviewType(e.target.value as InterviewType)
                }
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sif-when">Scheduled for</Label>
              <Input
                id="sif-when"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sif-dur">Duration (min)</Label>
              <Input
                id="sif-dur"
                type="number"
                min={15}
                max={480}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Number(e.target.value) || 60)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Scheduling…" : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

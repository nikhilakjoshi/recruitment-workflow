"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import {
  INTERVIEW_OUTCOMES,
  logInterviewOutcomeAction,
  type InterviewOutcome,
} from "@/app/(authed)/applications/[id]/interviews/[interviewId]/_actions";

type StoredOutcome = {
  outcome?: InterviewOutcome;
  reflection?: string;
  recordedAt?: string;
} | null;

type Props = {
  interviewId: string;
  applicationId: string;
  existing: StoredOutcome;
};

export function OutcomeTab({ interviewId, applicationId, existing }: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = React.useState<InterviewOutcome>(
    existing?.outcome ?? "MAYBE",
  );
  const [reflection, setReflection] = React.useState(existing?.reflection ?? "");
  const [rejectApplication, setRejectApplication] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const isNegative = outcome === "WEAK_NO" || outcome === "STRONG_NO";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await logInterviewOutcomeAction(interviewId, {
        outcome,
        reflection,
        rejectApplication: isNegative && rejectApplication,
      });
      if (!res.ok) {
        toastError(res.error);
        return;
      }
      toastSuccess(
        res.value.applicationRejected
          ? "Outcome saved — application moved to REJECTED"
          : "Outcome saved",
      );
      router.refresh();
      router.push(`/applications/${applicationId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="oc-outcome">Outcome</Label>
        <select
          id="oc-outcome"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as InterviewOutcome)}
        >
          {INTERVIEW_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="oc-reflection">Reflection</Label>
        <Textarea
          id="oc-reflection"
          rows={6}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="What went well, what to do differently next time…"
        />
      </div>
      {isNegative ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rejectApplication}
            onChange={(e) => setRejectApplication(e.target.checked)}
          />
          Also move Application to REJECTED
        </label>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save outcome"}
        </Button>
      </div>
      {existing?.outcome ? (
        <p className="text-xs text-muted-foreground">
          Previously logged{" "}
          {existing.recordedAt
            ? `at ${new Date(existing.recordedAt).toLocaleString()}`
            : ""}{" "}
          as <span className="font-medium">{existing.outcome}</span>.
        </p>
      ) : null}
    </form>
  );
}

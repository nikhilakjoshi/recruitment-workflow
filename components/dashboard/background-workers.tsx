"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlayIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { triggerScheduledWorkerAction } from "@/app/(authed)/_actions/workers";
import { ClearWorkspaceButton } from "./clear-workspace-button";

const WORKERS: Array<{ name: string; label: string; description: string }> = [
  {
    name: "application-tracker",
    label: "Application Tracker",
    description: "Sweeps applications for staleness and creates follow-up alerts.",
  },
  {
    name: "weekly-digest",
    label: "Weekly Digest",
    description: "Generates a one-paragraph narrative summary of the past 7 days.",
  },
  {
    name: "narrative-theme-extractor",
    label: "Narrative Themes",
    description: "Mines approved tailored resumes for recurring positioning themes.",
  },
];

export function BackgroundWorkersPanel() {
  const router = useRouter();
  const [running, setRunning] = React.useState<string | null>(null);

  async function handleRun(name: string) {
    setRunning(name);
    try {
      const res = await triggerScheduledWorkerAction(name);
      if (!res.ok) {
        toastError(`${name}: ${res.error}`);
        return;
      }
      toastSuccess(`${name} completed in ${res.durationMs}ms`);
      router.refresh();
    } finally {
      setRunning(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Background workers</CardTitle>
          <CardDescription>
            Manual triggers for the always-on workers. Run after meaningful activity to refresh
            follow-ups, digests, and themes.
          </CardDescription>
        </div>
        <ClearWorkspaceButton />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {WORKERS.map((w) => {
          const isRunning = running === w.name;
          return (
            <div
              key={w.name}
              className="flex items-start justify-between gap-3 rounded-md border border-input p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{w.label}</span>
                <span className="text-xs text-muted-foreground">{w.description}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRun(w.name)}
                disabled={running !== null}
              >
                {isRunning ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
                Run
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

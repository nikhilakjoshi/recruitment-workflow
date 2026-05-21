"use client";

import * as React from "react";
import type { Artifact } from "@prisma/client";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import {
  evaluationSchema,
  fitFromScore,
  type Evaluation,
  type Fit,
} from "@/lib/schemas/evaluation";
import { regenerateEvaluationAction } from "@/app/(authed)/applications/[id]/_actions";

type Props = {
  applicationId: string;
  artifact: Artifact | null;
};

export function EvaluationPanel({ applicationId, artifact }: Props) {
  const [pending, startTransition] = React.useTransition();

  if (!artifact) {
    return (
      <section
        data-slot="evaluation-panel"
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center"
      >
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        <h3 className="text-sm font-medium">Evaluation generating…</h3>
        <p className="text-xs text-muted-foreground">
          The match scorer runs once per minute. Refresh this page shortly.
        </p>
      </section>
    );
  }

  const parsed = evaluationSchema.safeParse(artifact.contentJson);
  if (!parsed.success) {
    return (
      <section
        data-slot="evaluation-panel"
        className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
      >
        <h3 className="font-medium">Evaluation artifact is malformed</h3>
        <p className="text-xs">artifact id: {artifact.id}</p>
      </section>
    );
  }

  const evaluation: Evaluation = { ...parsed.data, fit: fitFromScore(parsed.data.score) };

  function onRegenerate() {
    startTransition(async () => {
      const result = await regenerateEvaluationAction(applicationId);
      if (result.ok) {
        toastSuccess("Regenerate requested. New evaluation in ~1–2 minutes.");
      } else {
        toastError(result.error);
      }
    });
  }

  return (
    <section
      data-slot="evaluation-panel"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Match evaluation</h3>
        <span className="text-xs text-muted-foreground">v{artifact.versionNumber}</span>
      </header>

      <div className="flex items-center gap-3">
        <div className="text-4xl font-semibold tabular-nums">{evaluation.score}</div>
        <div className="flex flex-col gap-1">
          <FitBadge fit={evaluation.fit} />
          <span className="text-xs text-muted-foreground">
            Confidence: {evaluation.confidence}
          </span>
        </div>
      </div>

      <ScoreBar score={evaluation.score} />

      <div className="grid gap-3 sm:grid-cols-2">
        <BulletList title="Strengths" items={evaluation.strengths} />
        <BulletList title="Gaps" items={evaluation.gaps} emptyHint="(none identified)" />
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Rationale</summary>
        <p className="mt-2 whitespace-pre-wrap">{evaluation.rationale}</p>
      </details>

      <footer className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={pending}>
          <RefreshCwIcon className={pending ? "animate-spin" : ""} />
          Regenerate
        </Button>
      </footer>
    </section>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        aria-label={`Score: ${score} of 100`}
      />
    </div>
  );
}

function FitBadge({ fit }: { fit: Fit }) {
  if (fit === "STRONG") return <Badge variant="default">STRONG fit</Badge>;
  if (fit === "MARGINAL") return <Badge variant="secondary">MARGINAL fit</Badge>;
  return <Badge variant="outline">WEAK fit</Badge>;
}

function BulletList({
  title,
  items,
  emptyHint,
}: {
  title: string;
  items: string[];
  emptyHint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint ?? "—"}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

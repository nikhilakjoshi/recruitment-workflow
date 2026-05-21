"use client";

import { diffLines } from "diff";
import { cn } from "@/lib/utils";

type Props = {
  a: string;
  b: string;
};

export function TextDiff({ a, b }: Props) {
  const parts = diffLines(a, b);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DiffColumn title="Prior version" parts={parts} showSide="a" />
      <DiffColumn title="Current version" parts={parts} showSide="b" />
    </div>
  );
}

type DiffColumnProps = {
  title: string;
  parts: ReturnType<typeof diffLines>;
  showSide: "a" | "b";
};

function DiffColumn({ title, parts, showSide }: DiffColumnProps) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <pre className="max-h-96 overflow-auto rounded-lg border border-input bg-muted/30 p-3 text-xs whitespace-pre-wrap">
        {parts.map((p, i) => {
          if (p.added && showSide === "a") return null;
          if (p.removed && showSide === "b") return null;
          return (
            <span
              key={i}
              className={cn(
                p.added && "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200",
                p.removed && "bg-rose-500/20 text-rose-900 dark:text-rose-200",
              )}
            >
              {p.value}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

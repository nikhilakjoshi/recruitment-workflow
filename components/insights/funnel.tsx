import { type FunnelStageCount } from "@/lib/insights/funnel";

type Props = {
  rows: FunnelStageCount[];
};

export function Funnel({ rows }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => {
        const widthPct = Math.round((r.count / max) * 100);
        return (
          <div key={r.stage} className="flex items-center gap-3 text-sm">
            <div className="w-32 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
              {r.stage}
            </div>
            <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-primary/80 transition-all"
                style={{ width: `${widthPct}%` }}
                aria-label={`${r.stage}: ${r.count}`}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-foreground">
                {r.count}
              </span>
            </div>
            <div className="w-16 shrink-0 text-right text-xs text-muted-foreground">
              {r.conversionFromPrev !== null ? `${r.conversionFromPrev}%` : "—"}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Right column = % converted from the previous stage.
      </p>
    </div>
  );
}

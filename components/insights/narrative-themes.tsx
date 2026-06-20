import type { Insight } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { narrativeThemesSchema } from "@/lib/schemas/narrative-themes";

type Props = {
  insight: Insight | null;
};

export function NarrativeThemes({ insight }: Props) {
  if (!insight) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        No narrative themes derived yet. The extractor runs weekly (Sundays
        10:00 UTC) once you have ≥ 2 approved tailored resumes.
      </div>
    );
  }
  const parsed = narrativeThemesSchema.safeParse(insight.contentJson);
  if (!parsed.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Narrative themes insight is malformed (id: {insight.id})
      </div>
    );
  }
  const data = parsed.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
        AI-derived, non-authoritative. Treat these as positioning hypotheses,
        not facts.
      </div>
      <ul className="flex flex-col gap-3">
        {data.themes.map((t) => (
          <li key={t.label} className="rounded-lg border border-input bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-medium">{t.label}</h4>
              <span className="text-xs text-muted-foreground">×{t.frequency}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            {t.representativeBullets.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                {t.representativeBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <ThemeList title="Emergent" items={data.emergent} variant="default" />
        <ThemeList title="Fading" items={data.fading} variant="secondary" />
      </div>
      <p className="text-xs text-muted-foreground">
        Generated {new Date(insight.generatedAt).toLocaleString("en-US")}
      </p>
    </div>
  );
}

function ThemeList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: "default" | "secondary";
}) {
  return (
    <div className="flex flex-col gap-2">
      <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h5>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((i) => (
            <Badge key={i} variant={variant}>
              {i}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

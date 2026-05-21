"use client";

import * as React from "react";
import Link from "next/link";
import type { Artifact } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  interviewPrepSchema,
  type InterviewPrep,
} from "@/lib/schemas/interview-prep";

type Props = {
  applicationId: string;
  prep: Artifact | null;
  companyResearch: Artifact | null;
};

export function PrepTab({ applicationId, prep, companyResearch }: Props) {
  if (!prep) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Interview prep generating… refresh in a minute or two.
      </div>
    );
  }

  const parsed = interviewPrepSchema.safeParse(prep.contentJson);
  if (!parsed.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Interview prep artifact is malformed (id: {prep.id})
      </div>
    );
  }
  const data: InterviewPrep = parsed.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-6">
        <Section title="Expected questions">
          <ul className="flex flex-col gap-3">
            {data.expectedQuestions.map((q, i) => (
              <li key={i} className="rounded-lg border border-input bg-card p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline">{q.category}</Badge>
                  <span className="font-medium">{q.question}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Why:</span> {q.why}
                </p>
                {q.starPrompt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">STAR prompt:</span> {q.starPrompt}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="STAR stories">
          <ul className="flex flex-col gap-3">
            {data.starStories.map((s, i) => (
              <li key={i} className="rounded-lg border border-input bg-card p-3 text-sm">
                <h4 className="mb-2 font-medium">{s.label}</h4>
                <dl className="grid gap-1 text-xs text-muted-foreground">
                  <Field label="Situation" value={s.situation} />
                  <Field label="Task" value={s.task} />
                  <Field label="Action" value={s.action} />
                  <Field label="Result" value={s.result} />
                </dl>
                {s.relevantTo.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.relevantTo.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Questions to ask the interviewer">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {data.questionsToAsk.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      </div>

      <aside className="flex flex-col gap-3 rounded-lg border border-input bg-card p-4 text-sm">
        <h4 className="text-sm font-medium">Linked artifacts</h4>
        {companyResearch ? (
          <Link
            href={`/applications/${applicationId}?artifactId=${companyResearch.id}`}
            className="text-sm text-primary hover:underline"
          >
            Open Company Research (v{companyResearch.versionNumber})
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">
            No company research artifact yet.
          </p>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          Interview type: <span className="font-medium">{data.interviewType}</span>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wide">{label}</dt>
      <dd className="text-xs text-foreground">{value}</dd>
    </div>
  );
}

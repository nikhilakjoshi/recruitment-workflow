"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import {
  COVER_LETTER_PARAGRAPH_KINDS,
  coverLetterSchema,
  type CoverLetter,
  type CoverLetterParagraphKind,
} from "@/lib/schemas/cover-letter";

const KIND_LABELS: Record<CoverLetterParagraphKind, string> = {
  OPENING: "Opening",
  WHY_ME: "Why me",
  WHY_YOU: "Why you",
  CLOSE: "Close",
};

export type CoverLetterEditorProps = {
  applicationId: string;
  artifactId: string;
  initial: CoverLetter;
  onSaveNewVersion: (
    applicationId: string,
    artifactId: string,
    letter: CoverLetter,
  ) => Promise<{ ok: true; value: { artifactId: string } } | { ok: false; error: string }>;
  onRegenerateAll: (
    applicationId: string,
  ) => Promise<{ ok: true; value: { requested: true } } | { ok: false; error: string }>;
};

export function CoverLetterEditor({
  applicationId,
  artifactId,
  initial,
  onSaveNewVersion,
  onRegenerateAll,
}: CoverLetterEditorProps) {
  const [letter, setLetter] = React.useState<CoverLetter>(initial);
  const [saving, setSaving] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);

  function updateParagraph(kind: CoverLetterParagraphKind, text: string) {
    setLetter((l) => ({
      ...l,
      paragraphs: l.paragraphs.map((p) => (p.kind === kind ? { ...p, text } : p)),
    }));
  }

  async function save() {
    const parsed = coverLetterSchema.safeParse(letter);
    if (!parsed.success) {
      toastError("Cover letter failed schema validation; refine before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSaveNewVersion(applicationId, artifactId, parsed.data);
      if (result.ok) toastSuccess("Saved as new version");
      else toastError(result.error);
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const result = await onRegenerateAll(applicationId);
      if (result.ok) toastSuccess("Regenerate requested. New letter in ~1–2 minutes.");
      else toastError(result.error);
    } finally {
      setRegenerating(false);
    }
  }

  function discard() {
    setLetter(initial);
  }

  return (
    <div data-slot="cover-letter-editor" className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">Cover letter editor</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
            Discard changes
          </Button>
          <Button size="sm" variant="outline" onClick={regenerate} disabled={regenerating}>
            Regenerate all
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            Save as new version
          </Button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          aria-label="Recipient name"
          placeholder="Recipient name (optional)"
          value={letter.recipient.name ?? ""}
          onChange={(e) =>
            setLetter((l) => ({
              ...l,
              recipient: { ...l.recipient, name: e.target.value || undefined },
            }))
          }
        />
        <Input
          aria-label="Company"
          placeholder="Company"
          value={letter.recipient.company}
          onChange={(e) =>
            setLetter((l) => ({
              ...l,
              recipient: { ...l.recipient, company: e.target.value },
            }))
          }
        />
        <Input
          aria-label="Address"
          placeholder="Address (optional)"
          value={letter.recipient.address ?? ""}
          onChange={(e) =>
            setLetter((l) => ({
              ...l,
              recipient: { ...l.recipient, address: e.target.value || undefined },
            }))
          }
        />
      </div>

      {COVER_LETTER_PARAGRAPH_KINDS.map((kind) => {
        const p = letter.paragraphs.find((x) => x.kind === kind);
        return (
          <label key={kind} className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {KIND_LABELS[kind]}
            </span>
            <Textarea
              rows={5}
              aria-label={KIND_LABELS[kind]}
              value={p?.text ?? ""}
              onChange={(e) => updateParagraph(kind, e.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}

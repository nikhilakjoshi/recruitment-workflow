"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import {
  tailoredResumeSchema,
  type ResumeBullet,
  type ResumeSection,
  type TailoredResume,
} from "@/lib/schemas/tailored-resume";
import { InlineRewriteButton } from "./inline-rewrite-button";

export type ResumeEditorProps = {
  applicationId: string;
  artifactId: string;
  initial: TailoredResume;
  onSaveNewVersion: (
    applicationId: string,
    artifactId: string,
    resume: TailoredResume,
  ) => Promise<{ ok: true; value: { artifactId: string } } | { ok: false; error: string }>;
  onRewriteBullet: (
    applicationId: string,
    sectionIndex: number,
    bulletIndex: number,
    bullet: ResumeBullet,
  ) => Promise<{ ok: true; value: { text: string } } | { ok: false; error: string }>;
};

function bulletId(sectionIdx: number, bulletIdx: number) {
  return `s${sectionIdx}-b${bulletIdx}`;
}

export function ResumeEditor({
  applicationId,
  artifactId,
  initial,
  onSaveNewVersion,
  onRewriteBullet,
}: ResumeEditorProps) {
  const [resume, setResume] = React.useState<TailoredResume>(initial);
  const [rewriting, setRewriting] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function updateSection(idx: number, next: ResumeSection) {
    setResume((r) => ({
      ...r,
      sections: r.sections.map((s, i) => (i === idx ? next : s)),
    }));
  }

  function updateBullet(sectionIdx: number, bulletIdx: number, next: ResumeBullet) {
    setResume((r) => ({
      ...r,
      sections: r.sections.map((s, i) =>
        i === sectionIdx
          ? { ...s, bullets: s.bullets.map((b, j) => (j === bulletIdx ? next : b)) }
          : s,
      ),
    }));
  }

  function removeBullet(sectionIdx: number, bulletIdx: number) {
    setResume((r) => ({
      ...r,
      sections: r.sections.map((s, i) =>
        i === sectionIdx
          ? { ...s, bullets: s.bullets.filter((_, j) => j !== bulletIdx) }
          : s,
      ),
    }));
  }

  function reorderBullets(sectionIdx: number, from: number, to: number) {
    setResume((r) => ({
      ...r,
      sections: r.sections.map((s, i) =>
        i === sectionIdx ? { ...s, bullets: arrayMove(s.bullets, from, to) } : s,
      ),
    }));
  }

  async function rewriteBullet(sectionIdx: number, bulletIdx: number) {
    const id = bulletId(sectionIdx, bulletIdx);
    setRewriting(id);
    try {
      const bullet = resume.sections[sectionIdx]?.bullets[bulletIdx];
      if (!bullet) return;
      const result = await onRewriteBullet(applicationId, sectionIdx, bulletIdx, bullet);
      if (result.ok) {
        updateBullet(sectionIdx, bulletIdx, { ...bullet, text: result.value.text });
        toastSuccess("Bullet rewritten");
      } else {
        toastError(result.error);
      }
    } finally {
      setRewriting(null);
    }
  }

  async function save() {
    const parsed = tailoredResumeSchema.safeParse(resume);
    if (!parsed.success) {
      toastError("Resume failed schema validation; refine before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSaveNewVersion(applicationId, artifactId, parsed.data);
      if (result.ok) {
        toastSuccess("Saved as new version");
      } else {
        toastError(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setResume(initial);
  }

  return (
    <div data-slot="resume-editor" className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">Resume editor</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
            Discard changes
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            Save as new version
          </Button>
        </div>
      </header>

      <Input
        aria-label="Candidate name"
        value={resume.candidateName}
        onChange={(e) => setResume((r) => ({ ...r, candidateName: e.target.value }))}
      />

      {resume.sections.map((section, sIdx) => (
        <section
          key={`section-${sIdx}`}
          data-slot="resume-section"
          className="rounded-md border border-border p-3"
        >
          <Input
            aria-label={`Section ${sIdx + 1} title`}
            value={section.title}
            onChange={(e) => updateSection(sIdx, { ...section, title: e.target.value })}
          />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;
              const from = section.bullets.findIndex((_, j) => bulletId(sIdx, j) === active.id);
              const to = section.bullets.findIndex((_, j) => bulletId(sIdx, j) === over.id);
              if (from >= 0 && to >= 0) reorderBullets(sIdx, from, to);
            }}
          >
            <SortableContext
              items={section.bullets.map((_, j) => bulletId(sIdx, j))}
              strategy={verticalListSortingStrategy}
            >
              <ul className="mt-2 flex flex-col gap-2">
                {section.bullets.map((bullet, bIdx) => (
                  <SortableBullet
                    key={bulletId(sIdx, bIdx)}
                    id={bulletId(sIdx, bIdx)}
                    bullet={bullet}
                    pendingRewrite={rewriting === bulletId(sIdx, bIdx)}
                    onTextChange={(text) =>
                      updateBullet(sIdx, bIdx, { ...bullet, text })
                    }
                    onRewrite={() => rewriteBullet(sIdx, bIdx)}
                    onRemove={() => removeBullet(sIdx, bIdx)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </section>
      ))}
    </div>
  );
}

function SortableBullet({
  id,
  bullet,
  pendingRewrite,
  onTextChange,
  onRewrite,
  onRemove,
}: {
  id: string;
  bullet: ResumeBullet;
  pendingRewrite: boolean;
  onTextChange: (text: string) => void;
  onRewrite: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-slot="resume-bullet"
      data-bullet-id={id}
      className="flex items-start gap-2 rounded-md border border-border/60 bg-card p-2"
    >
      <button
        type="button"
        aria-label="Drag bullet"
        className="mt-1 cursor-grab text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <Textarea
        rows={2}
        value={bullet.text}
        aria-label={`Bullet ${id}`}
        onChange={(e) => onTextChange(e.target.value)}
        className="flex-1"
      />
      <div className="flex flex-col gap-1">
        <InlineRewriteButton pending={pendingRewrite} onClick={onRewrite} />
        <Button size="sm" variant="ghost" type="button" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  );
}

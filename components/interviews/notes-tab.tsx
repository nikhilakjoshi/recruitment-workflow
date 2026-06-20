"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { saveInterviewNotesAction } from "@/app/(authed)/applications/[id]/interviews/[interviewId]/_actions";

type Props = {
  interviewId: string;
  initialNotes: string;
};

const AUTOSAVE_INTERVAL_MS = 5_000;

export function NotesTab({ interviewId, initialNotes }: Props) {
  const [notes, setNotes] = React.useState(initialNotes);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const lastSavedRef = React.useRef(initialNotes);

  React.useEffect(() => {
    const id = setInterval(async () => {
      if (notes === lastSavedRef.current) return;
      setSaving(true);
      const res = await saveInterviewNotesAction(interviewId, notes);
      setSaving(false);
      if (res.ok) {
        lastSavedRef.current = notes;
        setSavedAt(res.value.savedAt);
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [interviewId, notes]);

  async function saveNow() {
    setSaving(true);
    const res = await saveInterviewNotesAction(interviewId, notes);
    setSaving(false);
    if (res.ok) {
      lastSavedRef.current = notes;
      setSavedAt(res.value.savedAt);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Notes autosave every 5 seconds.</span>
        <span>
          {saving
            ? "Saving…"
            : savedAt
              ? `Saved at ${new Date(savedAt).toLocaleTimeString("en-US")}`
              : "Unsaved"}
        </span>
      </div>
      <Textarea
        rows={20}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveNow}
        placeholder="Live notes from the interview…"
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { requestLinkedinOptimizationAction } from "@/app/(authed)/profile/_actions";

export function LinkedinOptimizerForm() {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await requestLinkedinOptimizationAction(text);
      if (!res.ok) {
        toastError(res.error);
        return;
      }
      toastSuccess(
        "Suggestions queued — review in the artifacts library once they land.",
      );
      setText("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Paste the visible text of your LinkedIn headline, About, and Experience
        sections. The optimizer drafts rewrites grounded in your Master CV and
        target roles. Suggestions land in the artifact approval gate — nothing
        is auto-published.
      </p>
      <Textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Headline: …
About: …
Experience: …"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {text.trim().length} chars
        </span>
        <Button type="submit" disabled={pending || text.trim().length < 50}>
          <Sparkles className="size-4" />
          {pending ? "Generating…" : "Generate rewrite suggestions"}
        </Button>
      </div>
    </form>
  );
}

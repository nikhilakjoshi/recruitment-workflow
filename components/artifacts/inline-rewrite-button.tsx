"use client";

import * as React from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  pending: boolean;
  onClick: () => void;
  label?: string;
};

export function InlineRewriteButton({ pending, onClick, label = "AI rewrite" }: Props) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={onClick}
      aria-label={label}
    >
      {pending ? (
        <Loader2Icon className="size-3 animate-spin" />
      ) : (
        <SparklesIcon className="size-3" />
      )}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

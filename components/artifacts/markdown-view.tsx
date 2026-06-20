"use client";

import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "github-markdown-css/github-markdown.css";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

export function MarkdownView({ content, className }: Props) {
  const { resolvedTheme } = useTheme();
  return (
    <div
      data-theme={resolvedTheme === "dark" ? "dark" : "light"}
      className={cn(
        "markdown-body max-h-[28rem] overflow-auto rounded-lg border border-input p-4 text-sm",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

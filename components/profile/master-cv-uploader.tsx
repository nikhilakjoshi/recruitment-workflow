"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/ui/toast";

type Props = {
  hasExistingCV: boolean;
};

export function MasterCVUploader({ hasExistingCV }: Props) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);

  function buttonLabel() {
    if (uploading) return "Uploading…";
    if (hasExistingCV) return "Replace Master CV";
    return "Upload Master CV (PDF)";
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/master-cv", { method: "POST", body: fd });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toastError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      toastSuccess("Master CV uploaded");
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Button
        type="button"
        variant={hasExistingCV ? "outline" : "default"}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloudIcon />
        {buttonLabel()}
      </Button>
      {hasExistingCV ? (
        <p className="text-xs text-muted-foreground">
          Existing CV stored. Re-upload to replace it.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          PDF up to 10MB. Stored privately in your workspace.
        </p>
      )}
    </div>
  );
}

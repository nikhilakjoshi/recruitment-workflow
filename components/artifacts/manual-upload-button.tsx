"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArtifactType } from "@prisma/client";
import { UploadIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { ARTIFACT_TYPES } from "@/lib/schemas/artifact-upload";

type Props = {
  applicationId: string;
};

export function ManualUploadButton({ applicationId }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [type, setType] = React.useState<ArtifactType>(ArtifactType.TAILORED_RESUME);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toastError("Pick a file first");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("applicationId", applicationId);
      fd.append("type", type);
      const res = await fetch("/api/upload/artifact", { method: "POST", body: fd });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toastError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      toastSuccess("Artifact uploaded — opens in approval gate");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UploadIcon /> Upload artifact
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload artifact</DialogTitle>
          <DialogDescription>
            PDF, .txt, or .md up to 10MB. Lands as a draft pending your approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="artifact-type">Type</Label>
            <select
              id="artifact-type"
              value={type}
              onChange={(e) => setType(e.target.value as ArtifactType)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
            >
              {ARTIFACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="artifact-file">File</Label>
            <Input
              id="artifact-file"
              type="file"
              ref={fileRef}
              accept="application/pdf,text/plain,text/markdown,.md,.txt"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

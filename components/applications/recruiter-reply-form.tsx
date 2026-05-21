"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MailOpenIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { logRecruiterReplyAction } from "@/app/(authed)/applications/[id]/_actions";

export type RecruiterOption = {
  id: string;
  name: string;
  email: string | null;
};

type Props = {
  applicationId: string;
  recruiters: RecruiterOption[];
};

const NEW_RECRUITER = "__new__";

export function RecruiterReplyForm({ applicationId, recruiters }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [recruiterId, setRecruiterId] = React.useState<string>(
    recruiters[0]?.id ?? NEW_RECRUITER,
  );
  const [newName, setNewName] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [body, setBody] = React.useState("");
  const [replyDate, setReplyDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [pending, setPending] = React.useState(false);

  const isNew = recruiterId === NEW_RECRUITER;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await logRecruiterReplyAction(applicationId, {
        recruiterId: isNew ? null : recruiterId,
        recruiterName: isNew ? newName : undefined,
        recruiterEmail: isNew ? newEmail || null : undefined,
        replyBody: body,
        replyDate,
      });
      if (!res.ok) {
        toastError(res.error);
        return;
      }
      toastSuccess("Recruiter reply logged");
      setOpen(false);
      setBody("");
      setNewName("");
      setNewEmail("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <MailOpenIcon /> Recruiter replied
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Recruiter replied</DialogTitle>
          <DialogDescription>
            Capture the reply. Triggers Company Research (Brave + Sonnet).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rrf-recruiter">Recruiter</Label>
            <select
              id="rrf-recruiter"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
              value={recruiterId}
              onChange={(e) => setRecruiterId(e.target.value)}
            >
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.email ? ` (${r.email})` : ""}
                </option>
              ))}
              <option value={NEW_RECRUITER}>+ New recruiter</option>
            </select>
          </div>
          {isNew ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rrf-name">Name</Label>
                <Input
                  id="rrf-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required={isNew}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rrf-email">Email (optional)</Label>
                <Input
                  id="rrf-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rrf-body">Reply body</Label>
            <Textarea
              id="rrf-body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rrf-date">Reply date</Label>
            <Input
              id="rrf-date"
              type="date"
              value={replyDate}
              onChange={(e) => setReplyDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Log reply"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

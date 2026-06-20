"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OpportunitySource } from "@prisma/client";
import { PlusIcon } from "lucide-react";
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
import {
  opportunityCreateSchema,
  type OpportunityCreateInput,
} from "@/lib/schemas/opportunity";
import { addOpportunityAction } from "@/app/(authed)/opportunities/_actions";

const SOURCE_OPTIONS: OpportunitySource[] = [
  OpportunitySource.LINKEDIN,
  OpportunitySource.INDEED,
  OpportunitySource.WELLFOUND,
  OpportunitySource.DIRECT,
  OpportunitySource.MANUAL,
  OpportunitySource.OTHER,
];

export function PasteJdModal() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<OpportunityCreateInput>({
    resolver: zodResolver(opportunityCreateSchema),
    defaultValues: {
      title: "",
      company: "",
      sourceUrl: "",
      sourcePlatform: OpportunitySource.MANUAL,
      jdText: "",
    },
  });
  const { register, handleSubmit, reset, formState } = form;

  async function onSubmit(values: OpportunityCreateInput) {
    const res = await addOpportunityAction(values);
    if (!res.ok) {
      toastError(res.error);
      return;
    }
    toastSuccess("Opportunity added");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <PlusIcon /> Add opportunity
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add opportunity</DialogTitle>
          <DialogDescription>
            Paste a job description. We&apos;ll save it and emit a JOB_DISCOVERED
            event.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jd-title">Title</Label>
              <Input id="jd-title" {...register("title")} />
              {formState.errors.title ? (
                <p className="text-xs text-destructive">{formState.errors.title.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jd-company">Company</Label>
              <Input id="jd-company" {...register("company")} />
              {formState.errors.company ? (
                <p className="text-xs text-destructive">{formState.errors.company.message}</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jd-url">Source URL (optional)</Label>
              <Input id="jd-url" placeholder="https://…" {...register("sourceUrl")} />
              {formState.errors.sourceUrl ? (
                <p className="text-xs text-destructive">{formState.errors.sourceUrl.message}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jd-platform">Source platform</Label>
              <select
                id="jd-platform"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
                {...register("sourcePlatform")}
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jd-text">Job description</Label>
            <Textarea
              id="jd-text"
              rows={10}
              placeholder="Paste the JD body here (≥ 50 chars)…"
              className="max-h-72 resize-y"
              {...register("jdText")}
            />
            {formState.errors.jdText ? (
              <p className="text-xs text-destructive">{formState.errors.jdText.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Saving…" : "Save opportunity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

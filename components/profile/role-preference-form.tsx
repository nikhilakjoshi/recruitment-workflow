"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RemotePolicy } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import {
  rolePreferenceSchema,
  type RolePreferenceInput,
} from "@/lib/schemas/role-preference";
import { saveRolePreferenceAction } from "@/app/(authed)/profile/_actions";

type Props = {
  defaultValues?: Partial<RolePreferenceInput>;
};

const REMOTE_OPTIONS: RemotePolicy[] = [
  RemotePolicy.REMOTE,
  RemotePolicy.HYBRID,
  RemotePolicy.ONSITE,
  RemotePolicy.ANY,
];

export function RolePreferenceForm({ defaultValues }: Props) {
  const router = useRouter();
  const form = useForm<RolePreferenceInput>({
    resolver: zodResolver(rolePreferenceSchema),
    defaultValues: {
      targetRoles: defaultValues?.targetRoles ?? [],
      targetIndustries: defaultValues?.targetIndustries ?? [],
      targetCompanies: defaultValues?.targetCompanies ?? [],
      excludedCompanies: defaultValues?.excludedCompanies ?? [],
      compMin: defaultValues?.compMin ?? null,
      compMax: defaultValues?.compMax ?? null,
      compCurrency: defaultValues?.compCurrency ?? "USD",
      geoLocations: defaultValues?.geoLocations ?? [],
      remotePolicy: defaultValues?.remotePolicy ?? RemotePolicy.ANY,
      workAuth: defaultValues?.workAuth ?? null,
      careerGoals: defaultValues?.careerGoals ?? null,
    },
  });

  const { control, register, handleSubmit, formState } = form;

  async function onSubmit(values: RolePreferenceInput) {
    const result = await saveRolePreferenceAction(values);
    if (!result.ok) {
      toastError(result.error);
      return;
    }
    toastSuccess("Preferences saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <FormField
        label="Target roles"
        error={formState.errors.targetRoles?.message}
      >
        <Controller
          control={control}
          name="targetRoles"
          render={({ field }) => (
            <TagInput
              value={field.value}
              onChange={field.onChange}
              placeholder="Staff Engineer, Engineering Manager…"
              id="targetRoles"
            />
          )}
        />
      </FormField>

      <FormField label="Target industries" error={formState.errors.targetIndustries?.message}>
        <Controller
          control={control}
          name="targetIndustries"
          render={({ field }) => (
            <TagInput
              value={field.value}
              onChange={field.onChange}
              placeholder="fintech, climate, developer tools…"
              id="targetIndustries"
            />
          )}
        />
      </FormField>

      <div className="grid gap-6 md:grid-cols-2">
        <FormField label="Target companies (optional)">
          <Controller
            control={control}
            name="targetCompanies"
            render={({ field }) => (
              <TagInput
                value={field.value}
                onChange={field.onChange}
                placeholder="Stripe, Vercel…"
                id="targetCompanies"
              />
            )}
          />
        </FormField>
        <FormField label="Excluded companies (optional)">
          <Controller
            control={control}
            name="excludedCompanies"
            render={({ field }) => (
              <TagInput
                value={field.value}
                onChange={field.onChange}
                placeholder="Companies you don't want to apply to"
                id="excludedCompanies"
              />
            )}
          />
        </FormField>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <FormField label="Min comp" error={formState.errors.compMin?.message}>
          <Input
            type="number"
            min={0}
            {...register("compMin", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
            })}
          />
        </FormField>
        <FormField label="Max comp" error={formState.errors.compMax?.message}>
          <Input
            type="number"
            min={0}
            {...register("compMax", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
            })}
          />
        </FormField>
        <FormField label="Currency" error={formState.errors.compCurrency?.message}>
          <Input maxLength={3} {...register("compCurrency")} />
        </FormField>
      </div>

      <FormField label="Geographies" error={formState.errors.geoLocations?.message}>
        <Controller
          control={control}
          name="geoLocations"
          render={({ field }) => (
            <TagInput
              value={field.value}
              onChange={field.onChange}
              placeholder="Remote (US), New York, Berlin…"
              id="geoLocations"
            />
          )}
        />
      </FormField>

      <FormField label="Remote policy">
        <Controller
          control={control}
          name="remotePolicy"
          render={({ field }) => (
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {REMOTE_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                    field.value === opt
                      ? "border-primary bg-primary/10"
                      : "border-input bg-transparent"
                  }`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={opt}
                    checked={field.value === opt}
                    onChange={() => field.onChange(opt)}
                    className="sr-only"
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
        />
      </FormField>

      <FormField label="Work authorization (optional)">
        <Input
          placeholder="US Citizen, EU work permit…"
          {...register("workAuth", {
            setValueAs: (v) => (v === "" || v == null ? null : String(v)),
          })}
        />
      </FormField>

      <FormField label="Career goals (optional)">
        <Textarea
          rows={4}
          placeholder="What kind of work you want next…"
          {...register("careerGoals", {
            setValueAs: (v) => (v === "" || v == null ? null : String(v)),
          })}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

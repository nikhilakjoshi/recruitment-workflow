import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { MasterCVUploader } from "@/components/profile/master-cv-uploader";
import { RolePreferenceForm } from "@/components/profile/role-preference-form";

type Search = { reason?: string };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getSession();
  const userId = session.userId!;
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { userId },
    include: { masterCV: true, rolePreference: true },
  });

  const params = await searchParams;
  const showIncompleteBanner = params.reason === "incomplete";

  const pref = candidate.rolePreference;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {showIncompleteBanner ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          Fill in your role preferences below to continue. The rest of the app
          unlocks once we know what you&apos;re looking for.
        </div>
      ) : null}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Master CV + role preferences. Workers read these to score
          opportunities and tailor outbound artifacts.
        </p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-medium">Master CV</h2>
        <MasterCVUploader hasExistingCV={Boolean(candidate.masterCV?.gcsUri)} />
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-medium">Role preferences</h2>
        <RolePreferenceForm
          defaultValues={
            pref
              ? {
                  targetRoles: pref.targetRoles,
                  targetIndustries: pref.targetIndustries,
                  targetCompanies: pref.targetCompanies,
                  excludedCompanies: pref.excludedCompanies,
                  compMin: pref.compMin ?? null,
                  compMax: pref.compMax ?? null,
                  compCurrency: pref.compCurrency,
                  geoLocations: pref.geoLocations,
                  remotePolicy: pref.remotePolicy,
                  workAuth: pref.workAuth ?? null,
                  careerGoals: pref.careerGoals ?? null,
                }
              : undefined
          }
        />
      </Card>
    </div>
  );
}

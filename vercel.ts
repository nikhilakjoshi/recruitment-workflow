import type { VercelConfig } from "@vercel/config/v1/types";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "pnpm build",
  // Crons intentionally removed — workers are triggered manually from the UI
  // (topbar "Process events" + Dashboard "Background workers" panel) so the
  // app can deploy on Vercel Hobby tier without needing minute-level crons.
  // To re-enable scheduling on Pro, restore the crons array:
  //   { path: "/api/cron/dispatch", schedule: "* * * * *" },
  //   { path: "/api/cron/scheduled/application-tracker", schedule: "0 9 * * *" },
  //   { path: "/api/cron/scheduled/weekly-digest", schedule: "0 9 * * 0" },
  //   { path: "/api/cron/narrative-themes", schedule: "0 10 * * 0" },
};

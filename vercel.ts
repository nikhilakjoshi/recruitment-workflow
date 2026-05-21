import type { VercelConfig } from "@vercel/config/v1/types";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "pnpm build",
  crons: [
    { path: "/api/cron/dispatch", schedule: "* * * * *" },
    { path: "/api/cron/scheduled/job-alert-aggregator", schedule: "0 8 * * *" },
    { path: "/api/cron/scheduled/application-tracker", schedule: "0 9 * * *" },
    { path: "/api/cron/scheduled/weekly-digest", schedule: "0 9 * * 0" },
  ],
};

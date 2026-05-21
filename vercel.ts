import type { VercelConfig } from "@vercel/config/v1/types";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "pnpm build",
  crons: [
    { path: "/api/cron/dispatch", schedule: "* * * * *" },
    { path: "/api/cron/narrative-themes", schedule: "0 10 * * 0" },
  ],
};

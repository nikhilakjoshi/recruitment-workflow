import type { VercelConfig } from "@vercel/config/v1/types";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "pnpm build",
  crons: [{ path: "/api/cron/dispatch", schedule: "* * * * *" }],
};

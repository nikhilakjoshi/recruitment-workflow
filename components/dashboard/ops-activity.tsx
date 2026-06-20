import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export async function OpsActivityPanel() {
  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000);
  const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [agg24h, agg7d, recent] = await Promise.all([
    prisma.lLMCall.aggregate({
      where: { startedAt: { gte: last24h } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    prisma.lLMCall.aggregate({
      where: { startedAt: { gte: last7d } },
      _sum: { costUsd: true },
      _count: true,
    }),
    prisma.lLMCall.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      select: {
        id: true,
        worker: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
        durationMs: true,
        startedAt: true,
      },
    }),
  ]);

  const cost24h = Number(agg24h._sum.costUsd ?? 0);
  const cost7d = Number(agg7d._sum.costUsd ?? 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ops activity & cost</CardTitle>
        <CardDescription>
          Every AI call goes through here. Monitor spend and recent worker invocations.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Cost (24h)" value={formatCost(cost24h)} />
          <Stat label="Calls (24h)" value={String(agg24h._count)} />
          <Stat label="Cost (7d)" value={formatCost(cost7d)} />
          <Stat label="Calls (7d)" value={String(agg7d._count)} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-muted-foreground">Recent calls</div>
          {recent.length === 0 ? (
            <div className="rounded-md border border-input p-3 text-xs text-muted-foreground">
              No AI calls yet. Shortlist a job and click Process events to start.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-input">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-2 py-1.5 font-medium">When</th>
                    <th className="px-2 py-1.5 font-medium">Worker</th>
                    <th className="px-2 py-1.5 font-medium">Model</th>
                    <th className="px-2 py-1.5 text-right font-medium">Tokens</th>
                    <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                        {new Date(r.startedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className="px-2 py-1">{r.worker}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px]">
                          {r.model.split("/").slice(-1)[0]}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right text-muted-foreground">
                        {r.inputTokens + r.outputTokens}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right font-medium">
                        {formatCost(Number(r.costUsd))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-input p-2.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
    </div>
  );
}

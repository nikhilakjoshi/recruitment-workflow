import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight">Career OS</span>
          <Badge variant="secondary">scaffolding ready</Badge>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Slice 0 — Foundation</CardTitle>
            <CardDescription>
              Next.js 16 + React 19 + Tailwind 4 + shadcn (base-ui) + Prisma 7 + AI Gateway ready.
              Real nav shell ships in issue #13.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <p className="text-sm text-muted-foreground mb-2">
                Sans (Geist) — the quick brown fox jumps over the lazy dog 0123456789
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                Mono (Geist Mono) — the quick brown fox jumps over the lazy dog 0123456789
              </p>
            </section>
            <section className="flex gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

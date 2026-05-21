import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export function AppTopbar({ email }: { email: string }) {
  return (
    <header
      data-slot="app-topbar"
      className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <SidebarTrigger className="md:hidden" />
      <Separator orientation="vertical" className="mx-1 h-5 md:hidden" />
      <div className="flex flex-1 items-center" />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu email={email} />
      </div>
    </header>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/signin");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: {
      email: true,
      candidate: {
        select: {
          id: true,
          rolePreference: { select: { id: true } },
        },
      },
    },
  });

  const pathname = (await headers()).get("x-pathname") ?? "";
  const hasRolePreference = Boolean(user.candidate?.rolePreference);
  if (!hasRolePreference && pathname !== "/profile") {
    redirect("/profile?reason=incomplete");
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AppTopbar email={user.email} />
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

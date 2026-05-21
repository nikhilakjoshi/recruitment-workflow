import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function RouteLoading({ className }: { className?: string }) {
  return (
    <div
      data-slot="route-loading"
      className={cn(
        "flex flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-6",
        className
      )}
    >
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex flex-col gap-2 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

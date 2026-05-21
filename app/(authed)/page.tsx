import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function DashboardPage() {
  return (
    <EmptyState
      icon={LayoutDashboard}
      title="Your dashboard is empty"
      description="Once you import a Master CV and start tracking opportunities, this page will show top suggestions, pending approvals, and live application status."
    />
  );
}

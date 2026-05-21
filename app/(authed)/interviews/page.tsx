import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function InterviewsPage() {
  return (
    <EmptyState
      icon={Calendar}
      title="No interviews scheduled"
      description="Upcoming interviews, prep packs, and STAR drafts will live here once you schedule them from an Application."
    />
  );
}

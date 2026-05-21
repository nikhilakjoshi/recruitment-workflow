import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function InterviewsTab() {
  return (
    <EmptyState
      icon={Calendar}
      title="No interviews yet"
      description="Once a recruiter responds and an interview is scheduled, it will show here with prep notes and STAR stories."
    />
  );
}

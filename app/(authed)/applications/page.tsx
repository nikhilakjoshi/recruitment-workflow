import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function ApplicationsPage() {
  return (
    <EmptyState
      icon={Briefcase}
      title="No applications yet"
      description="Once you shortlist an opportunity, it shows here with full state history — from Tailoring through Approved, Submitted, and beyond."
    />
  );
}

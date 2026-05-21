import { Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function OpportunitiesPage() {
  return (
    <EmptyState
      icon={Search}
      title="No opportunities yet"
      description="Paste a job description or URL to discover roles. Ranked matches will appear here ordered by fit, with one-click shortlist actions."
    />
  );
}

import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function InsightsPage() {
  return (
    <EmptyState
      icon={LineChart}
      title="No insights yet"
      description="Funnel metrics, response rates, common rejection themes, and weekly trend deltas will surface here once you've moved a few applications through the pipeline."
    />
  );
}

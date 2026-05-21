import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function ArtifactsPage() {
  return (
    <EmptyState
      icon={FileText}
      title="No artifacts yet"
      description="Tailored resumes, cover letters, evaluations, and prep packs will appear here grouped by Application — every one of them awaits your approval before going out."
    />
  );
}

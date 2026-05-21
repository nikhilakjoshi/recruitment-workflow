import { DashboardSection } from "./section-card";

export function RecruiterActivitySection() {
  return (
    <DashboardSection
      title="Recruiter Activity"
      description="Recent inbound from recruiters"
    >
      <p className="text-sm text-muted-foreground">
        Recruiter Reply detection arrives in chunk 8. This panel will surface
        new threads, response times, and engagement state.
      </p>
    </DashboardSection>
  );
}

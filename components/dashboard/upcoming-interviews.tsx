import { DashboardSection } from "./section-card";

export function UpcomingInterviewsSection() {
  return (
    <DashboardSection
      title="Upcoming Interviews"
      description="Scheduled interviews and prep readiness"
    >
      <p className="text-sm text-muted-foreground">
        Interview scheduling + prep arrive in chunk 8. This panel will list
        upcoming sessions with prep status indicators.
      </p>
    </DashboardSection>
  );
}

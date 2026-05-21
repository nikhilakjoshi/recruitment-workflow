import { User } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function ProfilePage() {
  return (
    <EmptyState
      icon={User}
      title="Profile not set up"
      description="The next chunk wires up Master CV upload, role preferences, and LinkedIn paste. For now this page is a placeholder."
    />
  );
}

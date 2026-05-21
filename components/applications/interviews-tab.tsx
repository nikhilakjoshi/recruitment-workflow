import Link from "next/link";
import { Calendar } from "lucide-react";
import type { Interview } from "@prisma/client";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InterviewWithRecruiter = Interview & {
  recruiter: { id: string; name: string } | null;
};

type Props = {
  applicationId: string;
  interviews: InterviewWithRecruiter[];
};

export function InterviewsTab({ applicationId, interviews }: Props) {
  if (interviews.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No interviews yet"
        description="Schedule an interview from the Overview tab. Prep materials and STAR stories will generate automatically."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Recruiter</TableHead>
          <TableHead>Scheduled</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead className="text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {interviews.map((iv) => (
          <TableRow key={iv.id}>
            <TableCell>
              <Badge variant="outline">{iv.interviewType}</Badge>
            </TableCell>
            <TableCell className="text-sm">{iv.recruiter?.name ?? "—"}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(iv.scheduledFor).toLocaleString()}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {iv.durationMinutes ? `${iv.durationMinutes} min` : "—"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {iv.outcomeJson ? "logged" : "—"}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/applications/${applicationId}/interviews/${iv.id}`}
                className="text-sm text-primary hover:underline"
              >
                Open
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

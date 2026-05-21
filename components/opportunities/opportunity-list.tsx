import type { Application, Opportunity } from "@prisma/client";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OpportunityRow } from "./opportunity-row";

type OpportunityWithApps = Opportunity & { applications: Application[] };

type Props = {
  opportunities: OpportunityWithApps[];
};

export function OpportunityList({ opportunities }: Props) {
  if (opportunities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No opportunities yet. Click <strong>Add opportunity</strong> to paste a
        JD.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {opportunities.map((opp) => (
          <OpportunityRow key={opp.id} opportunity={opp} />
        ))}
      </TableBody>
    </Table>
  );
}

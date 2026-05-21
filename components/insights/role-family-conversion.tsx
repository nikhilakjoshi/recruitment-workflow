import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RoleFamilyConversionRow } from "@/lib/insights/role-family";

type Props = {
  rows: RoleFamilyConversionRow[];
};

export function RoleFamilyConversion({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No applications grouped by role family yet.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role family (first targetRole)</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Offered</TableHead>
          <TableHead className="text-right">Conversion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.roleFamily}>
            <TableCell className="text-sm">{r.roleFamily}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{r.total}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{r.offered}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {r.conversionPct}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

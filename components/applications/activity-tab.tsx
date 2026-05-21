"use client";

import * as React from "react";
import type { Event } from "@prisma/client";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  events: Event[];
};

export function ActivityTab({ events }: Props) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events yet.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-44">When</TableHead>
          <TableHead className="w-64">Type</TableHead>
          <TableHead className="w-32">By</TableHead>
          <TableHead>Payload</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((ev) => (
          <ActivityRow key={ev.id} event={ev} />
        ))}
      </TableBody>
    </Table>
  );
}

function ActivityRow({ event }: { event: Event }) {
  const [expanded, setExpanded] = React.useState(false);
  const json = JSON.stringify(event.payloadJson);
  const preview = json.length > 80 ? json.slice(0, 80) + "…" : json;
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        {new Date(event.emittedAt).toLocaleString()}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{event.type}</Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{event.emittedBy}</TableCell>
      <TableCell>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-start gap-1 text-left text-xs hover:text-foreground"
        >
          {expanded ? (
            <ChevronDownIcon className="mt-0.5 size-3 shrink-0" />
          ) : (
            <ChevronRightIcon className="mt-0.5 size-3 shrink-0" />
          )}
          <pre className="whitespace-pre-wrap font-mono">
            {expanded ? JSON.stringify(event.payloadJson, null, 2) : preview}
          </pre>
        </button>
      </TableCell>
    </TableRow>
  );
}

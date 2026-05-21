import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

// Small wrapper to keep the seven dashboard sections visually consistent.
export function DashboardSection({ title, description, action, children }: Props) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecentMovementsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  movements: any[];
}

const movementIcons: Record<string, typeof ArrowUp> = {
  inbound: ArrowUp,
  outbound: ArrowDown,
  adjustment: RefreshCw,
};

const movementColors: Record<string, string> = {
  inbound: "text-green-600 dark:text-green-400",
  outbound: "text-red-600 dark:text-red-400",
  adjustment: "text-blue-600 dark:text-blue-400",
};

export function RecentMovements({ movements }: RecentMovementsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {movements.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No recent movements
          </div>
        ) : (
          <div className="space-y-3">
            {movements.slice(0, 8).map((m) => {
              const Icon = movementIcons[m.movement_type] || RefreshCw;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      movementColors[m.movement_type] || ""
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">
                      {m.product?.name || "Unknown Product"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.notes || m.movement_type}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={
                        m.quantity_change > 0 ? "default" : "destructive"
                      }
                      className="text-xs"
                    >
                      {m.quantity_change > 0 ? "+" : ""}
                      {m.quantity_change}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(m.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

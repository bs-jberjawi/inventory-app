"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Pie, PieChart, Cell } from "recharts";

interface StatusPieChartProps {
  data: { status: string; count: number }[];
}

const statusColors: Record<string, string> = {
  in_stock: "#22c55e",
  low_stock: "#f59e0b",
  out_of_stock: "#ef4444",
  ordered: "#3b82f6",
  discontinued: "#6b7280",
};

const statusLabels: Record<string, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  ordered: "Ordered",
  discontinued: "Discontinued",
};

export function StatusPieChart({ data }: StatusPieChartProps) {
  const chartConfig: ChartConfig = data.reduce(
    (acc, item) => ({
      ...acc,
      [item.status]: {
        label: statusLabels[item.status] || item.status,
        color: statusColors[item.status] || "#6b7280",
      },
    }),
    {} as ChartConfig
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stock Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <ChartContainer config={chartConfig} className="h-64 w-full max-w-[200px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={statusColors[entry.status] || "#6b7280"}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="space-y-2">
              {data.map((item) => (
                <div key={item.status} className="flex items-center gap-2 text-sm">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: statusColors[item.status] || "#6b7280",
                    }}
                  />
                  <span className="text-muted-foreground">
                    {statusLabels[item.status] || item.status}
                  </span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

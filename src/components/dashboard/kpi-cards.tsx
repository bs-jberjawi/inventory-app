"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Package, AlertTriangle, DollarSign, Layers } from "lucide-react";

interface KPICardsProps {
  stats: {
    total_products: number;
    low_stock_count: number;
    total_value: number;
    total_categories: number;
  };
}

export function KPICards({ stats }: KPICardsProps) {
  const cards = [
    {
      title: "Total Products",
      value: stats.total_products.toLocaleString(),
      icon: Package,
      desc: "Items in inventory",
      className: "",
    },
    {
      title: "Low Stock Alerts",
      value: stats.low_stock_count.toLocaleString(),
      icon: AlertTriangle,
      desc: "Items below threshold",
      className:
        stats.low_stock_count > 0
          ? "text-destructive"
          : "text-green-600 dark:text-green-400",
    },
    {
      title: "Total Value",
      value: `$${Number(stats.total_value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: DollarSign,
      desc: "Inventory worth",
      className: "",
    },
    {
      title: "Categories",
      value: stats.total_categories.toLocaleString(),
      icon: Layers,
      desc: "Product categories",
      className: "",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.className}`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

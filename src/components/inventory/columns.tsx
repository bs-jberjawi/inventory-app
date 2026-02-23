"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, PackageMinus } from "lucide-react";
import type { Product } from "@/lib/types/database";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  in_stock: { label: "In Stock", variant: "default" },
  low_stock: { label: "Low Stock", variant: "destructive" },
  out_of_stock: { label: "Out of Stock", variant: "destructive" },
  ordered: { label: "Ordered", variant: "secondary" },
  discontinued: { label: "Discontinued", variant: "outline" },
};

interface ColumnActions {
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
  userRole: string;
}

export function getColumns(actions: ColumnActions): ColumnDef<Product>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.sku}</p>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const cat = row.original.category;
        return cat ? (
          <Badge
            variant="outline"
            style={{ borderColor: cat.color, color: cat.color }}
          >
            {cat.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      filterFn: (row, _, filterValue) => {
        if (!filterValue || filterValue === "all") return true;
        return row.original.category_id === filterValue;
      },
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Qty
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const qty = row.original.quantity;
        const min = row.original.min_stock_level;
        return (
          <div>
            <span
              className={
                qty <= min
                  ? "font-bold text-destructive"
                  : "font-medium"
              }
            >
              {qty}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              / {min} min
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const config = statusConfig[row.original.status] || {
          label: row.original.status,
          variant: "outline" as const,
        };
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
      filterFn: (row, _, filterValue) => {
        if (!filterValue || filterValue === "all") return true;
        return row.original.status === filterValue;
      },
    },
    {
      accessorKey: "unit_price",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent"
        >
          Price
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span>
          $
          {Number(row.original.unit_price).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      id: "value",
      header: "Value",
      cell: ({ row }) => {
        const val = row.original.quantity * Number(row.original.unit_price);
        return (
          <span className="font-medium">
            ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;
        const canModify = actions.userRole === "admin" || actions.userRole === "manager";
        const canDelete = actions.userRole === "admin";

        if (!canModify) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onAdjustStock(product)}>
                <PackageMinus className="mr-2 h-4 w-4" />
                Adjust Stock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onEdit(product)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => actions.onDelete(product)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

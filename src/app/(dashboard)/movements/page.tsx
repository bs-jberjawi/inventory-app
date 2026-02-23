"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { StockMovement, MovementType } from "@/lib/types/database";

const PAGE_SIZE = 20;

const typeConfig: Record<string, { label: string; color: string; icon: typeof ArrowUp }> = {
  inbound: { label: "Inbound", color: "default", icon: ArrowUp },
  outbound: { label: "Outbound", color: "destructive", icon: ArrowDown },
  adjustment: { label: "Adjustment", color: "secondary", icon: RefreshCw },
};

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("stock_movements")
      .select("*, product:products(name, sku), profile:profiles(full_name)", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (typeFilter !== "all") {
      query = query.eq("movement_type", typeFilter as MovementType);
    }

    const { data, count } = await query;
    if (data) setMovements(data as unknown as StockMovement[]);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [supabase, page, typeFilter]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const filteredMovements = search
    ? movements.filter(
        (m) =>
          m.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
          m.product?.sku?.toLowerCase().includes(search.toLowerCase()) ||
          m.notes?.toLowerCase().includes(search.toLowerCase())
      )
    : movements;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Stock Movements</h2>
        <p className="text-muted-foreground">
          Audit log of all inventory changes.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by product or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v: string) => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No movements found.
                </TableCell>
              </TableRow>
            ) : (
              filteredMovements.map((m) => {
                const config = typeConfig[m.movement_type];
                const Icon = config?.icon || RefreshCw;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">
                      {format(new Date(m.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{m.product?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.product?.sku || ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={config?.color as "default" | "destructive" | "secondary" || "secondary"}
                        className="gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {config?.label || m.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-bold ${
                          m.quantity_change > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {m.quantity_change > 0 ? "+" : ""}
                        {m.quantity_change}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {m.notes || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.profile?.full_name || "System"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} movement(s) total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

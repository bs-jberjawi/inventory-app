"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/inventory/data-table";
import { getColumns } from "@/components/inventory/columns";
import { ProductForm } from "@/components/inventory/product-form";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { DeleteDialog } from "@/components/inventory/delete-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import type { Product, Category } from "@/lib/types/database";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const { role } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    const [productsRes, categoriesRes] = await Promise.all([
      supabase
        .from("products")
        .select("*, category:categories(*)")
        .order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);

    if (productsRes.data) setProducts(productsRes.data as unknown as Product[]);
    if (categoriesRes.data) setCategories(categoriesRes.data as Category[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();

    // Realtime subscription for product changes
    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchData]);

  const handleEdit = (product: Product) => {
    setEditProduct(product);
    setFormOpen(true);
  };

  const handleAddNew = () => {
    setEditProduct(null);
    setFormOpen(true);
  };

  const handleExportCSV = () => {
    const headers = [
      "Name",
      "SKU",
      "Category",
      "Quantity",
      "Min Stock",
      "Status",
      "Unit Price",
      "Value",
    ];
    const rows = products.map((p) => [
      p.name,
      p.sku,
      p.category?.name || "",
      p.quantity,
      p.min_stock_level,
      p.status,
      p.unit_price,
      (p.quantity * Number(p.unit_price)).toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const canModify = role === "admin" || role === "manager";

  const columns = getColumns({
    onEdit: handleEdit,
    onDelete: (p) => setDeleteProduct(p),
    onAdjustStock: (p) => setAdjustProduct(p),
    userRole: role,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
          <p className="text-muted-foreground">
            Manage your products and stock levels.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {canModify && (
            <Button size="sm" onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>
      </div>

      <DataTable columns={columns} data={products} categories={categories} />

      <ProductForm
        key={editProduct?.id || 'new'}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditProduct(null);
        }}
        product={editProduct}
        categories={categories}
        onSuccess={fetchData}
      />

      <StockAdjustDialog
        open={!!adjustProduct}
        onOpenChange={(open) => !open && setAdjustProduct(null)}
        product={adjustProduct}
        onSuccess={fetchData}
      />

      <DeleteDialog
        open={!!deleteProduct}
        onOpenChange={(open) => !open && setDeleteProduct(null)}
        product={deleteProduct}
        onSuccess={fetchData}
      />
    </div>
  );
}

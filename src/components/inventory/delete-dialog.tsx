"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Product } from "@/lib/types/database";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
}

export function DeleteDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  if (!product) return null;

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${product.name} deleted`);
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Product</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <strong>{product.name}</strong> (SKU: {product.sku})? This action
            cannot be undone. All related stock movements will also be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

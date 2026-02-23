"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Product, MovementType } from "@/lib/types/database";

interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
}

export function StockAdjustDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: StockAdjustDialogProps) {
  const [loading, setLoading] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<MovementType>("inbound");
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const supabase = createClient();

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setLoading(true);

    try {
      const quantityChange =
        adjustmentType === "outbound" ? -quantity : quantity;
      const newQuantity = product.quantity + quantityChange;

      if (newQuantity < 0) {
        toast.error("Cannot reduce stock below 0");
        setLoading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create stock movement record
      const { error: moveError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: product.id,
          quantity_change: quantityChange,
          movement_type: adjustmentType,
          notes: notes || null,
          created_by: user?.id ?? null,
        });
      if (moveError) throw moveError;

      // Update product quantity (trigger will handle status)
      const { error: prodError } = await supabase
        .from("products")
        .update({ quantity: newQuantity })
        .eq("id", product.id);
      if (prodError) throw prodError;

      toast.success(
        `Stock ${adjustmentType === "outbound" ? "reduced" : "added"}: ${quantity} units`
      );
      onSuccess();
      onOpenChange(false);
      setQuantity(0);
      setNotes("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {product.name} (SKU: {product.sku}) — Current qty:{" "}
            <strong>{product.quantity}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Movement Type</Label>
            <Select
              value={adjustmentType}
              onValueChange={(v: string) => setAdjustmentType(v as MovementType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound (Add Stock)</SelectItem>
                <SelectItem value="outbound">
                  Outbound (Remove Stock)
                </SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              value={quantity || ""}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              placeholder="Enter quantity"
              required
            />
            {adjustmentType === "outbound" && (
              <p className="text-xs text-muted-foreground">
                New quantity will be: {product.quantity - quantity}
              </p>
            )}
            {adjustmentType !== "outbound" && quantity > 0 && (
              <p className="text-xs text-muted-foreground">
                New quantity will be: {product.quantity + quantity}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

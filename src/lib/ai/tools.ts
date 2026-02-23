import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types/database";

// Service-role Supabase client for AI agent — bypasses RLS for cross-cutting analytics
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------------------------------------------------------------------------
// Shared Zod schemas — single source of truth for AI tools, MCP, and UI
// ---------------------------------------------------------------------------

export const searchInventorySchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Search term — product name, SKU, keyword, or description text (e.g., "laptop", "ELEC-001", "ergonomic"). Omit to list all items matching the other filters.'
    ),
  category: z
    .string()
    .optional()
    .describe(
      'Filter by category name (e.g., "Electronics", "Furniture"). Case-insensitive partial match.'
    ),
  status: z
    .enum(["in_stock", "low_stock", "out_of_stock", "ordered", "discontinued"])
    .optional()
    .describe("Filter by stock status"),
  low_stock_only: z
    .boolean()
    .optional()
    .describe(
      "If true, only return items where quantity is at or below their min_stock_level threshold"
    ),
});

export const getStockMovementsSchema = z.object({
  product_id: z
    .string()
    .describe("UUID of the product to get movements for"),
  start_date: z
    .string()
    .optional()
    .describe(
      'Start date in ISO format (e.g., "2026-01-01"). Defaults to 90 days ago if not provided.'
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      'End date in ISO format (e.g., "2026-02-23"). Defaults to today if not provided.'
    ),
});

export const getAnalyticsSchema = z.object({
  metric_type: z
    .enum(["overview", "category_breakdown", "movement_summary", "top_movers"])
    .describe(
      'Type of analytics: "overview" (total products, value, low stock count), "category_breakdown" (items and value per category), "movement_summary" (inbound/outbound totals for a period), "top_movers" (most active products by movement volume)'
    ),
  period_days: z
    .number()
    .optional()
    .describe("Number of days to look back for time-based metrics. Default 30."),
});

export const updateStockThresholdSchema = z.object({
  product_id: z.string().describe("UUID of the product to update"),
  new_threshold: z
    .number()
    .describe(
      "New minimum stock level (reorder point). Must be >= 0. Calculate based on: avg_daily_consumption * lead_time_days * (1 + safety_margin)"
    ),
  reason: z
    .string()
    .describe(
      "Detailed explanation of why this threshold was chosen, including the data and methodology used"
    ),
});

// ---------------------------------------------------------------------------
// AI SDK tool definitions with execute functions
// ---------------------------------------------------------------------------

export const inventoryTools = {
  search_inventory: tool({
    description:
      "Search inventory items by name, SKU, description, or category. Returns matching products with current stock levels, pricing, and status.",
    inputSchema: searchInventorySchema,
    execute: async ({ query, category, status, low_stock_only }) => {
      const supabase = getSupabase();

      let dbQuery = supabase
        .from("products")
        .select("*, category:categories(name, color)")
        .order("name");

      if (query) {
        dbQuery = dbQuery.or(
          `name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`
        );
      }

      if (status) {
        dbQuery = dbQuery.eq("status", status);
      }

      const { data, error } = await dbQuery.limit(25);
      if (error) return { error: error.message };

      let results = data || [];

      // Client-side filters that can't be expressed in PostgREST
      if (low_stock_only) {
        results = results.filter(
          (p: Record<string, unknown>) =>
            (p.quantity as number) <= (p.min_stock_level as number)
        );
      }
      if (category) {
        const catFilter = category.toLowerCase();
        results = results.filter((p: Record<string, unknown>) => {
          const cat = p.category as { name: string } | null;
          return cat?.name?.toLowerCase().includes(catFilter);
        });
      }

      return {
        count: results.length,
        products: results.map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          description: p.description,
          category:
            (p.category as { name: string } | null)?.name || "Uncategorized",
          quantity: p.quantity,
          min_stock_level: p.min_stock_level,
          status: p.status,
          unit_price: p.unit_price,
          total_value: (p.quantity as number) * Number(p.unit_price),
        })),
      };
    },
  }),

  get_stock_movements: tool({
    description:
      "Get stock movement history (inbound, outbound, adjustments) for a specific product over a date range. Essential for analyzing consumption rates, supply patterns, and demand trends before recommending stock thresholds.",
    inputSchema: getStockMovementsSchema,
    execute: async ({ product_id, start_date, end_date }) => {
      const supabase = getSupabase();

      const startDate =
        start_date ||
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = end_date || new Date().toISOString();

      const [productRes, movementsRes] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name, sku, quantity, min_stock_level, status, unit_price"
          )
          .eq("id", product_id)
          .single(),
        supabase
          .from("stock_movements")
          .select("*")
          .eq("product_id", product_id)
          .gte("created_at", startDate)
          .lte("created_at", endDate)
          .order("created_at", { ascending: true }),
      ]);

      if (productRes.error)
        return { error: `Product not found: ${productRes.error.message}` };

      const movements = movementsRes.data || [];
      const totalInbound = movements
        .filter((m) => m.movement_type === "inbound")
        .reduce((sum, m) => sum + m.quantity_change, 0);
      const totalOutbound = movements
        .filter((m) => m.movement_type === "outbound")
        .reduce((sum, m) => sum + Math.abs(m.quantity_change), 0);
      const daysBetween = Math.max(
        1,
        Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      return {
        product: productRes.data,
        period: { start: startDate, end: endDate, days: daysBetween },
        summary: {
          total_movements: movements.length,
          total_inbound: totalInbound,
          total_outbound: totalOutbound,
          net_change: totalInbound - totalOutbound,
          avg_daily_outbound: +(totalOutbound / daysBetween).toFixed(2),
          avg_daily_inbound: +(totalInbound / daysBetween).toFixed(2),
        },
        movements: movements.map((m) => ({
          date: m.created_at,
          type: m.movement_type,
          quantity: m.quantity_change,
          notes: m.notes,
        })),
      };
    },
  }),

  get_low_stock_items: tool({
    description:
      "Get all products currently at or below their minimum stock threshold, sorted by urgency (most critical first). Returns product name, SKU, current quantity, threshold, category, and unit price.",
    inputSchema: z.object({}),
    execute: async () => {
      const supabase = getSupabase();

      const { data, error } = await supabase.rpc("get_low_stock_items");
      if (error) return { error: error.message };

      // Fetch category names for context
      const productIds = (data || []).map(
        (p: Record<string, unknown>) => p.category_id
      );
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", productIds);

      const catMap = new Map(
        (categories || []).map((c: { id: string; name: string }) => [
          c.id,
          c.name,
        ])
      );

      return {
        count: (data || []).length,
        items: (data || []).map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: catMap.get(p.category_id as string) || "Unknown",
          quantity: p.quantity,
          min_stock_level: p.min_stock_level,
          deficit: (p.min_stock_level as number) - (p.quantity as number),
          unit_price: p.unit_price,
          status: p.status,
        })),
      };
    },
  }),

  get_analytics: tool({
    description:
      "Get inventory analytics and metrics. Supports various metric types for comprehensive inventory analysis.",
    inputSchema: getAnalyticsSchema,
    execute: async ({ metric_type, period_days }) => {
      const supabase = getSupabase();
      const periodDays = period_days || 30;
      const since = new Date(
        Date.now() - periodDays * 24 * 60 * 60 * 1000
      ).toISOString();

      switch (metric_type) {
        case "overview": {
          const { data } = await supabase.rpc("get_dashboard_stats");
          return { metric: "overview", data: data?.[0] || {} };
        }

        case "category_breakdown": {
          const { data } = await supabase
            .from("products")
            .select("quantity, unit_price, category:categories(name)");

          const breakdown = new Map<
            string,
            { items: number; total_quantity: number; total_value: number }
          >();
          (data || []).forEach((p: Record<string, unknown>) => {
            const catName =
              (p.category as { name: string } | null)?.name || "Uncategorized";
            const existing = breakdown.get(catName) || {
              items: 0,
              total_quantity: 0,
              total_value: 0,
            };
            existing.items += 1;
            existing.total_quantity += p.quantity as number;
            existing.total_value +=
              (p.quantity as number) * Number(p.unit_price);
            breakdown.set(catName, existing);
          });

          return {
            metric: "category_breakdown",
            data: Array.from(breakdown.entries()).map(([name, stats]) => ({
              category: name,
              ...stats,
            })),
          };
        }

        case "movement_summary": {
          const { data } = await supabase
            .from("stock_movements")
            .select("quantity_change, movement_type")
            .gte("created_at", since);

          let totalIn = 0,
            totalOut = 0,
            adjustments = 0;
          (data || []).forEach((m: Record<string, unknown>) => {
            if (m.movement_type === "inbound")
              totalIn += m.quantity_change as number;
            else if (m.movement_type === "outbound")
              totalOut += Math.abs(m.quantity_change as number);
            else adjustments += m.quantity_change as number;
          });

          return {
            metric: "movement_summary",
            period_days: periodDays,
            data: {
              total_inbound: totalIn,
              total_outbound: totalOut,
              total_adjustments: adjustments,
              net_change: totalIn - totalOut + adjustments,
              total_movements: (data || []).length,
            },
          };
        }

        case "top_movers": {
          const { data } = await supabase
            .from("stock_movements")
            .select(
              "product_id, quantity_change, product:products(name, sku)"
            )
            .gte("created_at", since);

          const movers = new Map<
            string,
            {
              name: string;
              sku: string;
              total_volume: number;
              movements: number;
            }
          >();
          (data || []).forEach((m: Record<string, unknown>) => {
            const pid = m.product_id as string;
            const prod = m.product as { name: string; sku: string } | null;
            const existing = movers.get(pid) || {
              name: prod?.name || "Unknown",
              sku: prod?.sku || "",
              total_volume: 0,
              movements: 0,
            };
            existing.total_volume += Math.abs(m.quantity_change as number);
            existing.movements += 1;
            movers.set(pid, existing);
          });

          const sorted = Array.from(movers.values())
            .sort((a, b) => b.total_volume - a.total_volume)
            .slice(0, 10);

          return {
            metric: "top_movers",
            period_days: periodDays,
            data: sorted,
          };
        }

        default:
          return { error: `Unknown metric type: ${metric_type}` };
      }
    },
  }),

  update_stock_threshold: tool({
    description:
      "Update the minimum stock level (reorder point) for a product. IMPORTANT: Always analyze stock movements first using get_stock_movements before recommending a threshold. Include your reasoning in the 'reason' parameter. Requires admin or manager role.",
    inputSchema: updateStockThresholdSchema,
    execute: async ({ product_id, new_threshold, reason }) => {
      // Defense-in-depth: verify role even if this tool shouldn't be
      // reachable for viewers (the route strips it from the tool set)
      const { createClient: createServerSupabase } = await import(
        "@/lib/supabase/server"
      );
      const supabase = await createServerSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const callerRole: UserRole =
        (user?.app_metadata?.role as UserRole) || "viewer";

      if (callerRole !== "admin" && callerRole !== "manager") {
        return {
          error:
            "Permission denied. Only admins and managers can update stock thresholds.",
        };
      }

      const serviceClient = getSupabase();

      // Get current product info
      const { data: before } = await serviceClient
        .from("products")
        .select("name, sku, min_stock_level, quantity")
        .eq("id", product_id)
        .single();

      if (!before) return { error: "Product not found" };

      const { data, error } = await serviceClient
        .from("products")
        .update({ min_stock_level: Math.round(new_threshold) })
        .eq("id", product_id)
        .select("name, sku, min_stock_level, quantity, status")
        .single();

      if (error) return { error: error.message };

      return {
        success: true,
        product: data,
        previous_threshold: before.min_stock_level,
        new_threshold: Math.round(new_threshold),
        reason,
      };
    },
  }),
};

// ---------------------------------------------------------------------------
// Role-gated tool sets — viewers only get read-only tools
// ---------------------------------------------------------------------------

type InventoryTools = typeof inventoryTools;

export function getToolsForRole(role: UserRole): InventoryTools {
  if (role === "admin" || role === "manager") {
    return inventoryTools;
  }

  // Viewers: strip all write tools
  const { update_stock_threshold: _removed, ...readOnlyTools } =
    inventoryTools;
  return readOnlyTools as unknown as InventoryTools;
}

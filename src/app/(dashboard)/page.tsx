import { createClient } from "@/lib/supabase/server";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { StatusPieChart } from "@/components/dashboard/status-pie-chart";
import { StockTrendChart } from "@/components/dashboard/stock-trend-chart";
import { RecentMovements } from "@/components/dashboard/recent-movements";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch dashboard data in parallel
  const [statsResult, categoryResult, statusResult, movementsResult, trendResult] =
    await Promise.all([
      supabase.rpc("get_dashboard_stats"),
      supabase
        .from("products")
        .select("category:categories(name, color), quantity")
        .order("quantity", { ascending: false }),
      supabase
        .from("products")
        .select("status"),
      supabase
        .from("stock_movements")
        .select("*, product:products(name, sku), profile:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("stock_movements")
        .select("quantity_change, movement_type, created_at")
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("created_at", { ascending: true }),
    ]);

  const stats = statsResult.data?.[0] ?? {
    total_products: 0,
    low_stock_count: 0,
    total_value: 0,
    total_categories: 0,
  };

  // Aggregate category data
  type CategoryProductRow = { category: { name: string; color: string } | null; quantity: number };
  const categoryMap = new Map<string, { name: string; color: string; count: number; value: number }>();
  ((categoryResult.data || []) as unknown as CategoryProductRow[]).forEach((p) => {
    const cat = p.category;
    if (cat) {
      const existing = categoryMap.get(cat.name) || {
        name: cat.name,
        color: cat.color,
        count: 0,
        value: 0,
      };
      existing.count += 1;
      existing.value += p.quantity;
      categoryMap.set(cat.name, existing);
    }
  });
  const categoryData = Array.from(categoryMap.values());

  // Aggregate status data
  type StatusRow = { status: string };
  const statusMap: Record<string, number> = {};
  ((statusResult.data || []) as StatusRow[]).forEach((p) => {
    statusMap[p.status] = (statusMap[p.status] || 0) + 1;
  });
  const statusData = Object.entries(statusMap).map(([status, count]) => ({
    status,
    count,
  }));

  // Aggregate trend data by day
  type TrendRow = { quantity_change: number; movement_type: string; created_at: string };
  const trendMap = new Map<string, { inbound: number; outbound: number }>();
  ((trendResult.data || []) as TrendRow[]).forEach((m) => {
    const day = new Date(m.created_at).toISOString().split("T")[0];
    const existing = trendMap.get(day) || { inbound: 0, outbound: 0 };
    if (m.movement_type === "inbound") {
      existing.inbound += m.quantity_change;
    } else if (m.movement_type === "outbound") {
      existing.outbound += Math.abs(m.quantity_change);
    }
    trendMap.set(day, existing);
  });
  const trendData = Array.from(trendMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your inventory status and recent activity.
        </p>
      </div>

      <KPICards stats={stats} />

      <div className="grid gap-6 md:grid-cols-2">
        <CategoryChart data={categoryData} />
        <StatusPieChart data={statusData} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <StockTrendChart data={trendData} />
        <RecentMovements movements={movementsResult.data || []} />
      </div>
    </div>
  );
}

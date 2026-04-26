/* eslint-disable @typescript-eslint/no-explicit-any */
// Add these imports at the top
import { useQuery } from "@tanstack/react-query"; // already there
import { useUserRole } from "@/hooks/useUserRole"; // add this
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react"; // add these
import { useState } from "react"; // add this
import { format } from "date-fns"; // add this
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Package,
  BarChart3,
  TrendingDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatPeso } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { subDays } from "date-fns";

export default function Dashboard() {
  const today = new Date().toISOString().split("T")[0];

  const { isAdmin } = useUserRole();
  const [revenueVisible, setRevenueVisible] = useState(false);

  // Check if today is closed
  const { data: todayLog } = useQuery({
    queryKey: ["dashboard-today-log", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, created_at, net_profit")
        .eq("log_date", today)
        .maybeSingle();
      return data;
    },
  });

  const { data: todayTransactions } = useQuery({
    queryKey: ["dashboard-transactions", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .eq("status", "completed");
      return data || [];
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("stock_quantity", { ascending: true })
        .limit(5);
      return (data || []).filter(
        (p) => p.stock_quantity <= p.low_stock_threshold,
      );
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["dashboard-top-products", today],
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_items")
        .select("product_id, quantity, products(name)")
        .gte("created_at", `${today}T00:00:00`);

      const productMap: Record<string, { name: string; total: number }> = {};
      (data || []).forEach((item) => {
        const pid = item.product_id || "unknown";
        const name = (item.products as any)?.name || "Unknown";
        if (!productMap[pid]) productMap[pid] = { name, total: 0 };
        productMap[pid].total += item.quantity;
      });

      return Object.values(productMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });

  // Slow-moving stock: products with <5 sales in last 30 days but still in stock
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const { data: slowMovingProducts } = useQuery({
    queryKey: ["dashboard-slow-moving"],
    queryFn: async () => {
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, stock_quantity, categories(name)")
        .eq("is_active", true)
        .gt("stock_quantity", 0);

      const { data: salesData } = await supabase
        .from("transaction_items")
        .select("product_id, quantity")
        .gte("created_at", thirtyDaysAgo);

      const salesMap: Record<string, number> = {};
      (salesData || []).forEach((item) => {
        salesMap[item.product_id!] =
          (salesMap[item.product_id!] || 0) + item.quantity;
      });

      return (allProducts || [])
        .map((p) => ({ ...p, sales30d: salesMap[p.id] || 0 }))
        .filter((p) => p.sales30d < 5)
        .sort((a, b) => a.sales30d - b.sales30d)
        .slice(0, 5);
    },
  });

  const totalRevenue =
    todayTransactions?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
  const totalTransactions = todayTransactions?.length || 0;
  const avgOrder = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Today's overview for your store</p>
      </div>

      {/* Day close status */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm w-fit ${
          todayLog
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            : "bg-amber-50 dark:bg-amber-950/20 border-amber-500/20 text-amber-700 dark:text-amber-400"
        }`}
      >
        {todayLog ? (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Store day closed —{" "}
              {format(new Date(todayLog.created_at), "h:mm a")}
            </span>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Store day not yet closed</span>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Revenue</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-success">
                    {isAdmin
                      ? revenueVisible
                        ? formatPeso(totalRevenue)
                        : "₱ ••••••"
                      : "₱ ••••••"}
                  </p>
                  {isAdmin && (
                    <button
                      onClick={() => setRevenueVisible((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {revenueVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">Admin only</p>
                )}
              </div>
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">{totalTransactions}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Order</p>
                <p className="text-2xl font-bold">{formatPeso(avgOrder)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          asChild
          variant="outline"
          className="h-20 text-left justify-start gap-3"
        >
          <Link to="/sales">
            <ShoppingCart className="h-5 w-5" />
            <div>
              <p className="font-medium">New Sale</p>
              <p className="text-xs text-muted-foreground">Start checkout</p>
            </div>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-20 text-left justify-start gap-3"
        >
          <Link to="/inventory">
            <Package className="h-5 w-5" />
            <div>
              <p className="font-medium">Inventory</p>
              <p className="text-xs text-muted-foreground">Manage stock</p>
            </div>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-20 text-left justify-start gap-3"
        >
          <Link to="/reports">
            <BarChart3 className="h-5 w-5" />
            <div>
              <p className="font-medium">Reports</p>
              <p className="text-xs text-muted-foreground">View analytics</p>
            </div>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Products Today</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts && topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{p.name}</span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {p.total} sold
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No sales yet today
              </p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts && lowStockProducts.length > 0 ? (
              <div className="space-y-3">
                {lowStockProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(p.categories as any)?.name}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium ${p.stock_quantity === 0 ? "text-destructive" : "text-warning"}`}
                    >
                      {p.stock_quantity} left
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                All stock levels are healthy
              </p>
            )}
          </CardContent>
        </Card>

        {/* Slow-Moving Stock */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Slow-Moving Stock
              <Badge variant="outline" className="ml-1 text-xs font-normal">
                Last 30 days
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {slowMovingProducts && slowMovingProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {slowMovingProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(p.categories as any)?.name} · {p.stock_quantity} in
                        stock
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{p.sales30d} sold</p>
                      <p className="text-xs text-muted-foreground">30 days</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                All products are selling well
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

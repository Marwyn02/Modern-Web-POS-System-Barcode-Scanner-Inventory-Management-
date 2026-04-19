/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  Line,
  PieChart,
  Pie,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { formatPeso } from "@/utils/format";

// ─── Consistent color palette ────────────────────────────────────────────────
const COLORS = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  indigo: "#6366f1",
  teal: "#14b8a6",
  pink: "#ec4899",
  orange: "#f97316",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  gray: "#6b7280",
};

const BAR_COLORS = [
  COLORS.indigo,
  COLORS.green,
  COLORS.amber,
  COLORS.pink,
  COLORS.teal,
  COLORS.orange,
  COLORS.violet,
  COLORS.cyan,
];

// Shared tooltip style — works in dark mode
const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#f9fafb",
  },
  labelStyle: { color: "#f9fafb", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "#d1d5db" },
};

const axisStyle = { fontSize: 12, fill: "#9ca3af" };
const gridStyle = { stroke: "#374151", opacity: 0.5 };

// ─── Component ────────────────────────────────────────────────────────────────
export default function Reports() {
  const [period, setPeriod] = useState("7");

  const startDate = startOfDay(subDays(new Date(), parseInt(period)));
  const endDate = endOfDay(new Date());

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: transactions = [] } = useQuery({
    queryKey: ["report-transactions", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .eq("status", "completed")
        .order("created_at");
      return data || [];
    },
  });

  const { data: refundedTx = [] } = useQuery({
    queryKey: ["report-refunded", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .eq("status", "refunded");
      return data || [];
    },
  });

  const { data: topProductsData = [] } = useQuery({
    queryKey: ["report-top-products", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_items")
        .select("product_id, quantity, subtotal, products(name)")
        .gte("created_at", startDate.toISOString());

      const map: Record<
        string,
        { name: string; qty: number; revenue: number }
      > = {};
      (data || []).forEach((item) => {
        const pid = item.product_id || "unknown";
        const name = (item.products as any)?.name || "Unknown";
        if (!map[pid]) map[pid] = { name, qty: 0, revenue: 0 };
        map[pid].qty += item.quantity;
        map[pid].revenue += Number(item.subtotal);
      });
      return Object.values(map)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    },
  });

  const { data: inventoryValue } = useQuery({
    queryKey: ["report-inventory-value"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("price, cost_price, stock_quantity")
        .eq("is_active", true);
      return {
        totalRetail: (data || []).reduce(
          (s, p) => s + Number(p.price) * p.stock_quantity,
          0,
        ),
        totalCost: (data || []).reduce(
          (s, p) => s + Number(p.cost_price || 0) * p.stock_quantity,
          0,
        ),
        totalItems: (data || []).reduce((s, p) => s + p.stock_quantity, 0),
      };
    },
  });

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const { data: slowMoving = [] } = useQuery({
    queryKey: ["report-slow-moving"],
    queryFn: async () => {
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, stock_quantity, price, categories(name)")
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
        .map((p) => ({
          ...p,
          sales30d: salesMap[p.id] || 0,
          stockValue: Number(p.price) * p.stock_quantity,
        }))
        .filter((p) => p.sales30d < 5)
        .sort((a, b) => a.sales30d - b.sales30d)
        .slice(0, 12);
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["report-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role")
        .eq("is_active", true);
      return data || [];
    },
  });

  const { data: disposedItems = [] } = useQuery({
    queryKey: ["report-disposed", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("disposed_items")
        .select("*, products(name)")
        .gte("disposed_at", startDate.toISOString())
        .lte("disposed_at", endDate.toISOString());
      return data || [];
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const cashierPerf = employees
    .map((emp) => {
      const empTx = transactions.filter((t) => t.employee_id === emp.id);
      return {
        name: emp.name,
        role: emp.role,
        txCount: empTx.length,
        revenue: empTx.reduce((s, t) => s + Number(t.total_amount), 0),
        avgOrder: empTx.length
          ? empTx.reduce((s, t) => s + Number(t.total_amount), 0) / empTx.length
          : 0,
      };
    })
    .filter((e) => e.txCount > 0)
    .sort((a, b) => b.revenue - a.revenue);

  // Daily revenue: regular vs discounted stacked bars
  const dailyRevenue = (() => {
    const days = parseInt(period);
    const map: Record<
      string,
      { date: string; regular: number; discounted: number }
    > = {};
    for (let i = 0; i < days; i++) {
      const d = format(subDays(new Date(), days - 1 - i), "MMM d");
      map[d] = { date: d, regular: 0, discounted: 0 };
    }
    transactions.forEach((t) => {
      const d = format(new Date(t.created_at), "MMM d");
      if (map[d]) {
        if (t.discount_type) map[d].discounted += Number(t.total_amount);
        else map[d].regular += Number(t.total_amount);
      }
    });
    return Object.values(map).map((v) => ({
      ...v,
      regular: Math.round(v.regular * 100) / 100,
      discounted: Math.round(v.discounted * 100) / 100,
    }));
  })();

  // Totals
  const totalRevenue = transactions.reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const totalTx = transactions.length;
  const totalRefunds = refundedTx.reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const refundCount = refundedTx.length;

  // Discount breakdown
  const pwdTx = transactions.filter((t) => t.discount_type === "pwd");
  const seniorTx = transactions.filter((t) => t.discount_type === "senior");
  const nearExpiryTx = transactions.filter(
    (t) => t.discount_type === "near_expiry",
  );
  const totalPwdDisc = pwdTx.reduce(
    (s, t) => s + Number(t.discount_amount || 0),
    0,
  );
  const totalSenDisc = seniorTx.reduce(
    (s, t) => s + Number(t.discount_amount || 0),
    0,
  );
  const totalNearDisc = nearExpiryTx.reduce(
    (s, t) => s + Number(t.discount_amount || 0),
    0,
  );
  const totalWasteLoss = disposedItems.reduce(
    (s, d) => s + Number(d.total_loss || 0),
    0,
  );

  // Pie data for discount/refund/waste breakdown
  const impactPieData = [
    { name: "PWD Discount", value: totalPwdDisc, fill: COLORS.teal },
    { name: "Senior Discount", value: totalSenDisc, fill: COLORS.indigo },
    { name: "Near-Expiry Discount", value: totalNearDisc, fill: COLORS.amber },
    { name: "Refunds", value: totalRefunds, fill: COLORS.red },
    { name: "Stock Loss", value: totalWasteLoss, fill: COLORS.gray },
  ].filter((d) => d.value > 0);

  // Daily refunds line for overlay
  const dailyRefunds = (() => {
    const days = parseInt(period);
    const map: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = format(subDays(new Date(), days - 1 - i), "MMM d");
      map[d] = 0;
    }
    refundedTx.forEach((t) => {
      const d = format(new Date(t.created_at), "MMM d");
      if (map[d] !== undefined) map[d] += Number(t.total_amount);
    });
    return Object.entries(map).map(([date, refunds]) => ({ date, refunds }));
  })();

  // Merge revenue + refund for combined chart
  const combinedDailyData = dailyRevenue.map((r, i) => ({
    ...r,
    refunds: dailyRefunds[i]?.refunds || 0,
  }));

  // Cashier radar — normalise for radar chart
  const maxRev = Math.max(...cashierPerf.map((c) => c.revenue), 1);
  const cashierRadar = cashierPerf.slice(0, 6).map((c) => ({
    name: c.name.split(" ")[0],
    Revenue: Math.round((c.revenue / maxRev) * 100),
    Transactions: Math.min(c.txCount * 5, 100),
  }));

  // Export
  const exportCSV = () => {
    if (!transactions.length) return;
    const headers =
      "Date,Transaction ID,Amount,Payment Method,Discount Type,Discount Amount\n";
    const rows = transactions
      .map(
        (t) =>
          `${format(new Date(t.created_at), "yyyy-MM-dd HH:mm")},${t.id},${t.total_amount},${t.payment_method},${t.discount_type || "none"},${t.discount_amount || 0}`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">
            Sales performance and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total Revenue",
            value: formatPeso(totalRevenue),
            color: "text-success",
          },
          { label: "Transactions", value: totalTx.toString(), color: "" },
          {
            label: "Refunds",
            value: formatPeso(totalRefunds),
            color: "text-destructive",
            sub: `${refundCount} orders`,
          },
          {
            label: "Inventory Value",
            value: formatPeso(inventoryValue?.totalRetail || 0),
            color: "",
          },
          {
            label: "Items in Stock",
            value: (inventoryValue?.totalItems || 0).toString(),
            color: "",
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              {k.sub && (
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="revenue">
        <TabsList className="tabs-scroll flex w-full overflow-x-auto scrollbar-none h-auto p-1 justify-start">
          <TabsTrigger value="revenue" className="shrink-0">
            <TrendingUp className="h-3 w-3 mr-1" /> Revenue Trend
          </TabsTrigger>
          <TabsTrigger value="products" className="shrink-0">
            <Package className="h-3 w-3 mr-1" /> Top Products
          </TabsTrigger>
          <TabsTrigger value="cashier" className="shrink-0">
            <Users className="h-3 w-3 mr-1" /> Sales per Cashier
          </TabsTrigger>
          <TabsTrigger value="slow" className="shrink-0">
            <TrendingDown className="h-3 w-3 mr-1" /> Slow Moving
          </TabsTrigger>
          <TabsTrigger value="impact" className="shrink-0">
            <AlertTriangle className="h-3 w-3 mr-1" /> Discounts, Refunds &
            Waste
          </TabsTrigger>
        </TabsList>

        {/* ── 1. Revenue Trend ──────────────────────────────────────────────── */}
        <TabsContent value="revenue" className="space-y-4">
          {/* Stacked bar: regular vs discounted */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Daily Revenue — Regular vs
                Discounted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={combinedDailyData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis tick={axisStyle} tickFormatter={(v) => `₱${v}`} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value, name) => [
                        formatPeso(Number(value)),
                        name === "regular"
                          ? "Regular Sales"
                          : name === "discounted"
                            ? "Discounted Sales"
                            : "Refunds",
                      ]}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: "#9ca3af", fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                    <Bar
                      dataKey="regular"
                      stackId="rev"
                      fill={COLORS.green}
                      name="Regular Sales"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="discounted"
                      stackId="rev"
                      fill={COLORS.amber}
                      name="Discounted Sales"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="refunds"
                      stroke={COLORS.red}
                      strokeWidth={2}
                      dot={{ fill: COLORS.red, r: 3 }}
                      name="Refunds"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Green = regular sales · Amber = discounted sales · Red line =
                refunds
              </p>
            </CardContent>
          </Card>

          {/* Revenue summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Regular Revenue",
                value: formatPeso(
                  dailyRevenue.reduce((s, d) => s + d.regular, 0),
                ),
                color: "text-success",
              },
              {
                label: "Discounted Revenue",
                value: formatPeso(
                  dailyRevenue.reduce((s, d) => s + d.discounted, 0),
                ),
                color: "text-amber-500",
              },
              {
                label: "Total Refunds",
                value: formatPeso(totalRefunds),
                color: "text-destructive",
              },
              {
                label: "Net Revenue",
                value: formatPeso(totalRevenue - totalRefunds),
                color: "",
              },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── 2. Top Products ───────────────────────────────────────────────── */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Top Products by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProductsData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  No data for this period
                </p>
              ) : (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topProductsData}
                      layout="vertical"
                      barCategoryGap="20%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        {...gridStyle}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={axisStyle}
                        tickFormatter={(v) => `₱${v}`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={130}
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [
                          formatPeso(Number(value)),
                          "Revenue",
                        ]}
                      />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                        {topProductsData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={BAR_COLORS[i % BAR_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Sales per Cashier ──────────────────────────────────────────── */}
        <TabsContent value="cashier" className="space-y-4">
          {/* Bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Revenue per Cashier
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cashierPerf.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  No data for this period
                </p>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashierPerf} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                      <XAxis dataKey="name" tick={axisStyle} />
                      <YAxis tick={axisStyle} tickFormatter={(v) => `₱${v}`} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value, name) => [
                          name === "revenue"
                            ? formatPeso(Number(value))
                            : value,
                          name === "revenue" ? "Revenue" : "Transactions",
                        ]}
                      />
                      <Legend
                        formatter={(v) => (
                          <span style={{ color: "#9ca3af", fontSize: 12 }}>
                            {v === "revenue" ? "Revenue" : "Transactions"}
                          </span>
                        )}
                      />
                      <Bar
                        dataKey="revenue"
                        fill={COLORS.indigo}
                        name="revenue"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="txCount"
                        fill={COLORS.teal}
                        name="txCount"
                        radius={[4, 4, 0, 0]}
                        yAxisId="right"
                        hide
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Radar chart — only when 3+ cashiers */}
          {cashierRadar.length >= 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Performance Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={cashierRadar}>
                      <PolarGrid stroke="#374151" />
                      <PolarAngleAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#9ca3af" }}
                      />
                      <Radar
                        name="Revenue %"
                        dataKey="Revenue"
                        stroke={COLORS.indigo}
                        fill={COLORS.indigo}
                        fillOpacity={0.25}
                      />
                      <Radar
                        name="Transactions %"
                        dataKey="Transactions"
                        stroke={COLORS.teal}
                        fill={COLORS.teal}
                        fillOpacity={0.2}
                      />
                      <Legend
                        formatter={(v) => (
                          <span style={{ color: "#9ca3af", fontSize: 12 }}>
                            {v}
                          </span>
                        )}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, n) => [`${Number(v)}%`, n as string]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Scores normalised to 100 — higher = better relative
                  performance
                </p>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashierPerf.map((c, i) => (
                    <TableRow key={c.name}>
                      <TableCell className="text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{c.txCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPeso(c.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(c.avgOrder)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cashierPerf.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 4. Slow Moving ────────────────────────────────────────────────── */}
        <TabsContent value="slow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4" /> Slow-Moving Stock
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {"<"}5 sales in 30 days
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slowMoving.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  All products are moving well
                </p>
              ) : (
                <>
                  {/* Bubble-style bar: stock value vs 30d sales */}
                  <div className="h-[320px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={slowMoving.slice(0, 10)}
                        layout="vertical"
                        barCategoryGap="20%"
                        barGap={4}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          {...gridStyle}
                          horizontal={false}
                        />
                        <XAxis type="number" tick={axisStyle} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={130}
                          tick={{ fontSize: 11, fill: "#9ca3af" }}
                        />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(value, name) => [
                            name === "stockValue"
                              ? formatPeso(Number(value))
                              : `${Number(value)} units`,
                            name === "stockValue"
                              ? "Stock Value (₱)"
                              : "30-day Sales",
                          ]}
                        />
                        <Legend
                          formatter={(v) => (
                            <span style={{ color: "#9ca3af", fontSize: 12 }}>
                              {v === "stockValue"
                                ? "Stock Value (₱)"
                                : "30-day Sales (units)"}
                            </span>
                          )}
                        />
                        <Bar
                          dataKey="stockValue"
                          fill={COLORS.amber}
                          name="stockValue"
                          radius={[0, 4, 4, 0]}
                        />
                        <Bar
                          dataKey="sales30d"
                          fill={COLORS.indigo}
                          name="sales30d"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mb-4">
                    Amber = capital tied up in stock · Indigo = units actually
                    sold in 30 days
                  </p>

                  {/* Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">In Stock</TableHead>
                        <TableHead className="text-right">30d Sales</TableHead>
                        <TableHead className="text-right">
                          Stock Value
                        </TableHead>
                        <TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slowMoving.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.name}
                          </TableCell>
                          <TableCell>
                            {(p.categories as any)?.name || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.stock_quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.sales30d}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPeso(p.stockValue)}
                          </TableCell>
                          <TableCell>
                            {p.sales30d === 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                Dead Stock
                              </Badge>
                            ) : (
                              <Badge className="bg-warning text-warning-foreground text-xs">
                                Slow
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 5. Discounts, Refunds & Waste (merged) ───────────────────────── */}
        <TabsContent value="impact" className="space-y-4">
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: "PWD Discounts",
                value: formatPeso(totalPwdDisc),
                sub: `${pwdTx.length} tx`,
                color: "text-teal-500",
              },
              {
                label: "Senior Discounts",
                value: formatPeso(totalSenDisc),
                sub: `${seniorTx.length} tx`,
                color: "text-indigo-400",
              },
              {
                label: "Near-Expiry Disc.",
                value: formatPeso(totalNearDisc),
                sub: `${nearExpiryTx.length} tx`,
                color: "text-amber-500",
              },
              {
                label: "Total Refunds",
                value: formatPeso(totalRefunds),
                sub: `${refundCount} orders`,
                color: "text-destructive",
              },
              {
                label: "Stock Waste Loss",
                value: formatPeso(totalWasteLoss),
                sub: `${disposedItems.reduce((s, d) => s + d.quantity, 0)} units`,
                color: "text-destructive",
              },
            ].map((k) => (
              <div key={k.label} className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie — breakdown of all revenue impacts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Revenue Impact Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {impactPieData.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    No discounts, refunds, or waste this period
                  </p>
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={impactPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ percent }: any) =>
                            percent > 0.05
                              ? `${(percent * 100).toFixed(0)}%`
                              : ""
                          }
                          labelLine={false}
                        >
                          {impactPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(value, name) => [
                            formatPeso(Number(value)),
                            name as string,
                          ]}
                        />
                        <Legend
                          formatter={(value) => (
                            <span style={{ color: "#9ca3af", fontSize: 11 }}>
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bar — daily refunds trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Refunds Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRefunds} barCategoryGap="40%">
                      <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
                      <XAxis dataKey="date" tick={axisStyle} />
                      <YAxis tick={axisStyle} tickFormatter={(v) => `₱${v}`} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [
                          formatPeso(Number(value)),
                          "Refunds",
                        ]}
                      />
                      <Bar
                        dataKey="refunds"
                        fill={COLORS.red}
                        radius={[4, 4, 0, 0]}
                        name="Refunds"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Discount audit table */}
          {[...pwdTx, ...seniorTx, ...nearExpiryTx].length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Discount Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-xs">ID</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Customer ID</TableHead>
                        <TableHead className="text-right text-xs">
                          Original
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Discount
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Final
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...pwdTx, ...seniorTx, ...nearExpiryTx]
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
                        )
                        .map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-mono text-xs">
                              {tx.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(tx.created_at), "MMM d, h:mm a")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`text-xs ${
                                  tx.discount_type === "pwd"
                                    ? "bg-teal-600 text-white"
                                    : tx.discount_type === "senior"
                                      ? "bg-indigo-600 text-white"
                                      : "bg-amber-600 text-white"
                                }`}
                              >
                                {tx.discount_type
                                  ?.replace("_", " ")
                                  .toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {tx.customer_id_number || "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatPeso(Number(tx.original_amount))}
                            </TableCell>
                            <TableCell className="text-right text-xs text-amber-500">
                              -{formatPeso(Number(tx.discount_amount))}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium">
                              {formatPeso(Number(tx.total_amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disposed items table */}
          {disposedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Disposed / Wasted Items
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total Loss</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disposedItems.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {(d.products as any)?.name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {d.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {d.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPeso(Number(d.unit_cost))}
                        </TableCell>
                        <TableCell className="text-right text-destructive font-medium">
                          {formatPeso(Number(d.total_loss))}
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(d.disposed_at!), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Refunds table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Refund Transactions
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  Rate:{" "}
                  {totalTx + refundCount > 0
                    ? ((refundCount / (totalTx + refundCount)) * 100).toFixed(1)
                    : "0.0"}
                  %
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {refundedTx.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No refunds in this period
                </p>
              ) : (
                <div className="max-h-[280px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-xs">ID</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-right text-xs">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refundedTx.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs">
                            {tx.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(
                              new Date(tx.created_at),
                              "MMM d, yyyy h:mm a",
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {tx.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {formatPeso(Number(tx.total_amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  RotateCcw,
  AlertTriangle,
  Clock,
  Calendar,
  ShoppingBasket,
  BarChart3,
  DollarSign,
  Percent,
  Activity,
} from "lucide-react";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  getHours,
  getDay,
} from "date-fns";
import { formatPeso } from "@/utils/format";

// ── Color System ──────────────────────────────────────────────────────────────
const C = {
  emerald: "#10b981",
  emeraldLight: "#34d399",
  amber: "#f59e0b",
  amberLight: "#fcd34d",
  rose: "#f43f5e",
  roseLight: "#fb7185",
  indigo: "#6366f1",
  indigoLight: "#818cf8",
  teal: "#14b8a6",
  tealLight: "#2dd4bf",
  violet: "#8b5cf6",
  violetLight: "#a78bfa",
  orange: "#f97316",
  cyan: "#06b6d4",
  pink: "#ec4899",
  sky: "#0ea5e9",
  lime: "#84cc16",
  gray: "#6b7280",
};

const BAR_COLORS = [
  C.indigo,
  C.emerald,
  C.amber,
  C.pink,
  C.teal,
  C.orange,
  C.violet,
  C.cyan,
  C.sky,
  C.lime,
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "10px",
    color: "#f9fafb",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
    fontSize: 12,
  },
  labelStyle: { color: "#e5e7eb", fontWeight: 600, marginBottom: 6 },
  itemStyle: { color: "#9ca3af" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

const axisStyle = { fontSize: 11, fill: "#6b7280" };
const gridStyle = { stroke: "#1f2937", strokeDasharray: "3 3" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  color = "",
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: any;
  trend?: { value: number; label: string };
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            {trend && (
              <div
                className={`flex items-center gap-1 text-xs font-medium ${
                  trend.value >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.label}
              </div>
            )}
          </div>
          {Icon && (
            <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  sub,
}: {
  icon: any;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Reports() {
  const [period, setPeriod] = useState("7");

  const startDate = startOfDay(subDays(new Date(), parseInt(period)));
  const endDate = endOfDay(new Date());

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: transactions = [] } = useQuery({
    queryKey: ["report-transactions", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, transaction_items(quantity)")
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
        .select(
          "id, name, stock_quantity, price, low_stock_threshold, categories(name)",
        )
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

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["report-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "id, name, stock_quantity, low_stock_threshold, categories(name)",
        )
        .eq("is_active", true)
        .order("stock_quantity", { ascending: true })
        .limit(10);
      return (data || []).filter(
        (p) => p.stock_quantity <= p.low_stock_threshold,
      );
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["report-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role, user_id")
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

  // ── Derived Analytics ─────────────────────────────────────────────────────────
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
  const totalVat = transactions.reduce((s, t) => s + Number(t.vat_amount), 0);
  const totalWasteLoss = disposedItems.reduce(
    (s, d) => s + Number(d.total_loss || 0),
    0,
  );
  const totalDiscounts = transactions.reduce(
    (s, t) => s + Number(t.discount_amount || 0),
    0,
  );

  // ATV & items per transaction
  const avgTransactionValue = totalTx > 0 ? totalRevenue / totalTx : 0;
  const totalItemsSold = useMemo(() => {
    return transactions.reduce((s, t) => {
      const items = (t as any).transaction_items || [];
      return (
        s + items.reduce((si: number, i: any) => si + (i.quantity || 0), 0)
      );
    }, 0);
  }, [transactions]);
  const avgItemsPerTx = totalTx > 0 ? totalItemsSold / totalTx : 0;

  // Refund rate
  const refundRate =
    totalTx + refundCount > 0
      ? (refundCount / (totalTx + refundCount)) * 100
      : 0;

  // Estimated profit
  const refundVat = refundedTx.reduce((s, t) => s + Number(t.vat_amount), 0);
  const estimatedProfit =
    totalRevenue - totalVat - totalRefunds - totalWasteLoss + refundVat;

  // Cashier performance
  const cashierPerf = employees
    .map((emp) => {
      const empTx = transactions.filter((t) => t.employee_id === emp.user_id);
      const revenue = empTx.reduce((s, t) => s + Number(t.total_amount), 0);
      return {
        name: emp.name.split(" ")[0],
        fullName: emp.name,
        role: emp.role,
        txCount: empTx.length,
        revenue,
        avgOrder: empTx.length ? revenue / empTx.length : 0,
      };
    })
    .filter((e) => e.txCount > 0)
    .sort((a, b) => b.revenue - a.revenue);

  // Peak hours
  const peakHours = useMemo(() => {
    const hours: Record<number, { revenue: number; count: number }> = {};
    for (let h = 0; h < 24; h++) hours[h] = { revenue: 0, count: 0 };
    transactions.forEach((t) => {
      const h = getHours(new Date(t.created_at));
      hours[h].revenue += Number(t.total_amount);
      hours[h].count += 1;
    });
    return Object.entries(hours)
      .filter(([h]) => parseInt(h) >= 6 && parseInt(h) <= 22)
      .map(([h, v]) => ({
        hour:
          parseInt(h) === 0
            ? "12AM"
            : parseInt(h) < 12
              ? `${h}AM`
              : parseInt(h) === 12
                ? "12PM"
                : `${parseInt(h) - 12}PM`,
        revenue: Math.round(v.revenue),
        transactions: v.count,
        h: parseInt(h),
      }));
  }, [transactions]);

  // Day of week performance
  const dowPerf = useMemo(() => {
    const days: Record<number, { revenue: number; count: number }> = {};
    for (let d = 0; d < 7; d++) days[d] = { revenue: 0, count: 0 };
    transactions.forEach((t) => {
      const d = getDay(new Date(t.created_at));
      days[d].revenue += Number(t.total_amount);
      days[d].count += 1;
    });
    return DAYS.map((name, i) => ({
      day: name,
      revenue: Math.round(days[i].revenue),
      transactions: days[i].count,
    }));
  }, [transactions]);

  // Daily revenue + transaction trend
  const dailyTrend = useMemo(() => {
    const days = parseInt(period);
    const map: Record<
      string,
      {
        date: string;
        revenue: number;
        transactions: number;
        refunds: number;
        regular: number;
        discounted: number;
      }
    > = {};
    for (let i = 0; i < days; i++) {
      const d = format(subDays(new Date(), days - 1 - i), "MMM d");
      map[d] = {
        date: d,
        revenue: 0,
        transactions: 0,
        refunds: 0,
        regular: 0,
        discounted: 0,
      };
    }
    transactions.forEach((t) => {
      const d = format(new Date(t.created_at), "MMM d");
      if (map[d]) {
        map[d].revenue += Number(t.total_amount);
        map[d].transactions += 1;
        if (t.discount_type) map[d].discounted += Number(t.total_amount);
        else map[d].regular += Number(t.total_amount);
      }
    });
    refundedTx.forEach((t) => {
      const d = format(new Date(t.created_at), "MMM d");
      if (map[d]) map[d].refunds += Number(t.total_amount);
    });
    return Object.values(map).map((v) => ({
      ...v,
      revenue: Math.round(v.revenue * 100) / 100,
      regular: Math.round(v.regular * 100) / 100,
      discounted: Math.round(v.discounted * 100) / 100,
      refunds: Math.round(v.refunds * 100) / 100,
    }));
  }, [transactions, refundedTx, period]);

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
  const discountedRevenue = transactions
    .filter((t) => t.discount_type)
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const regularRevenue = totalRevenue - discountedRevenue;

  const impactPieData = [
    { name: "PWD Discount", value: totalPwdDisc, fill: C.teal },
    { name: "Senior Discount", value: totalSenDisc, fill: C.indigo },
    { name: "Near-Expiry Disc.", value: totalNearDisc, fill: C.amber },
    { name: "Refunds", value: totalRefunds, fill: C.rose },
    { name: "Waste Loss", value: totalWasteLoss, fill: C.gray },
  ].filter((d) => d.value > 0);

  // Max cashier for radar
  const maxRev = Math.max(...cashierPerf.map((c) => c.revenue), 1);
  const cashierRadar = cashierPerf.slice(0, 6).map((c) => ({
    name: c.name,
    Revenue: Math.round((c.revenue / maxRev) * 100),
    Transactions: Math.min(c.txCount * 5, 100),
    AvgOrder: Math.round((c.avgOrder / avgTransactionValue) * 50),
  }));

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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground text-sm">
            Business intelligence for smarter decisions
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
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* ── Section 1: Overview KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Revenue"
          value={formatPeso(totalRevenue)}
          color="text-emerald-500"
          icon={DollarSign}
          sub={`${totalTx} transactions`}
        />
        <KpiCard
          label="Est. Net Profit"
          value={formatPeso(estimatedProfit)}
          color={estimatedProfit >= 0 ? "text-emerald-500" : "text-rose-500"}
          icon={TrendingUp}
          sub="after VAT, refunds & waste"
        />
        <KpiCard
          label="Avg Transaction"
          value={formatPeso(avgTransactionValue)}
          icon={ShoppingBasket}
          sub={`${avgItemsPerTx.toFixed(1)} items/sale avg`}
        />
        <KpiCard
          label="Refund Rate"
          value={`${refundRate.toFixed(1)}%`}
          color={refundRate > 5 ? "text-rose-500" : "text-muted-foreground"}
          icon={RotateCcw}
          sub={`${refundCount} refunded orders`}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Transactions"
          value={totalTx.toString()}
          icon={Activity}
          sub={`${formatPeso(totalRevenue / Math.max(parseInt(period), 1))}/day avg`}
        />
        <KpiCard
          label="Total Refunds"
          value={formatPeso(totalRefunds)}
          color="text-rose-500"
          icon={RotateCcw}
        />
        <KpiCard
          label="Inventory Value"
          value={formatPeso(inventoryValue?.totalRetail || 0)}
          icon={Package}
          sub={`${inventoryValue?.totalItems || 0} items in stock`}
        />
        <KpiCard
          label="Total Discounts"
          value={formatPeso(totalDiscounts)}
          color="text-amber-500"
          icon={Percent}
          sub={`${transactions.filter((t) => t.discount_type).length} discounted tx`}
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="trends">
        <TabsList className="flex w-full overflow-x-auto scrollbar-none h-auto p-1 justify-start gap-1">
          {[
            { value: "trends", label: "Trends", icon: TrendingUp },
            { value: "operations", label: "Operations", icon: Clock },
            { value: "cashier", label: "Cashiers", icon: Users },
            { value: "products", label: "Products", icon: Package },
            {
              value: "impact",
              label: "Discounts & Waste",
              icon: AlertTriangle,
            },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 flex items-center gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── 1. Trends ─────────────────────────────────────────────────────── */}
        <TabsContent value="trends" className="space-y-4 mt-4">
          {/* Revenue + Transaction dual axis */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={TrendingUp}
                title="Revenue & Transaction Volume"
                sub="Daily trend — revenue bars + transaction count line"
              />
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyTrend} barCategoryGap="30%">
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={C.emerald}
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="100%"
                          stopColor={C.teal}
                          stopOpacity={0.7}
                        />
                      </linearGradient>
                      <linearGradient id="discGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={C.amber}
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="100%"
                          stopColor={C.orange}
                          stopOpacity={0.7}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis
                      yAxisId="left"
                      tick={axisStyle}
                      tickFormatter={(v) =>
                        `₱${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={axisStyle}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value, name) => {
                        if (name === "transactions")
                          return [value, "Transactions"];
                        return [
                          formatPeso(Number(value)),
                          name === "regular"
                            ? "Regular"
                            : name === "discounted"
                              ? "Discounted"
                              : "Refunds",
                        ];
                      }}
                    />
                    <Legend
                      formatter={(v) => (
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>
                          {v === "regular"
                            ? "Regular Sales"
                            : v === "discounted"
                              ? "Discounted Sales"
                              : v === "refunds"
                                ? "Refunds"
                                : "Transactions"}
                        </span>
                      )}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="regular"
                      stackId="rev"
                      fill="url(#revGrad)"
                      name="regular"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="discounted"
                      stackId="rev"
                      fill="url(#discGrad)"
                      name="discounted"
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="transactions"
                      stroke={C.violet}
                      strokeWidth={2.5}
                      dot={{ fill: C.violet, r: 3, strokeWidth: 0 }}
                      name="transactions"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="refunds"
                      stroke={C.rose}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={false}
                      name="refunds"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Profit trend area chart */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={DollarSign}
                title="Revenue Breakdown Summary"
                sub="Regular vs discounted sales proportion"
              />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  {
                    label: "Regular Revenue",
                    value: formatPeso(regularRevenue),
                    color: "text-emerald-500",
                    pct:
                      totalRevenue > 0
                        ? ((regularRevenue / totalRevenue) * 100).toFixed(0) +
                          "%"
                        : "0%",
                  },
                  {
                    label: "Discounted Revenue",
                    value: formatPeso(discountedRevenue),
                    color: "text-amber-500",
                    pct:
                      totalRevenue > 0
                        ? ((discountedRevenue / totalRevenue) * 100).toFixed(
                            0,
                          ) + "%"
                        : "0%",
                  },
                  {
                    label: "Total Refunds",
                    value: formatPeso(totalRefunds),
                    color: "text-rose-500",
                    pct: `${refundRate.toFixed(1)}% rate`,
                  },
                  {
                    label: "Net Revenue",
                    value: formatPeso(totalRevenue - totalRefunds),
                    color: "",
                    pct: "after refunds",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="p-3 rounded-xl border bg-muted/20 space-y-1"
                  >
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-base font-bold ${s.color}`}>
                      {s.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.pct}</p>
                  </div>
                ))}
              </div>

              {/* Stacked area for cumulative view */}
              <div className="h-50">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="areaReg" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={C.emerald}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor={C.emerald}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                      <linearGradient id="areaDisc" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={C.amber}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor={C.amber}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis
                      tick={axisStyle}
                      tickFormatter={(v) =>
                        `₱${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                      }
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v, n) => [
                        formatPeso(Number(v)),
                        n === "regular" ? "Regular" : "Discounted",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="regular"
                      stackId="1"
                      stroke={C.emerald}
                      fill="url(#areaReg)"
                      strokeWidth={2}
                      name="regular"
                    />
                    <Area
                      type="monotone"
                      dataKey="discounted"
                      stackId="1"
                      stroke={C.amber}
                      fill="url(#areaDisc)"
                      strokeWidth={2}
                      name="discounted"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 2. Operations ─────────────────────────────────────────────────── */}
        <TabsContent value="operations" className="space-y-4 mt-4">
          {/* Peak Hours */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={Clock}
                title="Peak Hours"
                sub="Sales revenue and transaction volume by hour of day"
              />
            </CardHeader>
            <CardContent>
              {peakHours.every((h) => h.transactions === 0) ? (
                <p className="text-center py-12 text-muted-foreground text-sm">
                  No data for this period
                </p>
              ) : (
                <div className="h-75">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={peakHours} barCategoryGap="20%">
                      <defs>
                        <linearGradient
                          id="hourGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={C.sky}
                            stopOpacity={0.9}
                          />
                          <stop
                            offset="100%"
                            stopColor={C.indigo}
                            stopOpacity={0.7}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="hour" tick={axisStyle} />
                      <YAxis
                        yAxisId="left"
                        tick={axisStyle}
                        tickFormatter={(v) =>
                          `₱${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                        }
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={axisStyle}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, n) =>
                          n === "revenue"
                            ? [formatPeso(Number(v)), "Revenue"]
                            : [v, "Transactions"]
                        }
                      />
                      <Legend
                        formatter={(v) => (
                          <span style={{ color: "#9ca3af", fontSize: 11 }}>
                            {v === "revenue" ? "Revenue" : "Transactions"}
                          </span>
                        )}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="revenue"
                        fill="url(#hourGrad)"
                        name="revenue"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="transactions"
                        stroke={C.violet}
                        strokeWidth={2.5}
                        dot={{ fill: C.violet, r: 3, strokeWidth: 0 }}
                        name="transactions"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center mt-2">
                💡 Use peak hours to schedule more cashiers and plan restocking
                times
              </p>
            </CardContent>
          </Card>

          {/* Day of Week */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={Calendar}
                title="Day-of-Week Performance"
                sub="Which days drive the most revenue"
              />
            </CardHeader>
            <CardContent>
              <div className="h-65">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dowPerf} barCategoryGap="30%">
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="day" tick={axisStyle} />
                    <YAxis
                      tick={axisStyle}
                      tickFormatter={(v) =>
                        `₱${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                      }
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v, n) =>
                        n === "revenue"
                          ? [formatPeso(Number(v)), "Revenue"]
                          : [v, "Transactions"]
                      }
                    />
                    <Legend
                      formatter={(v) => (
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>
                          {v === "revenue" ? "Revenue" : "Transactions"}
                        </span>
                      )}
                    />
                    <Bar dataKey="revenue" name="revenue" radius={[5, 5, 0, 0]}>
                      {dowPerf.map((_, i) => (
                        <Cell
                          key={i}
                          fill={BAR_COLORS[i % BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                💡 Identify strongest days to time promotions and deliveries
              </p>
            </CardContent>
          </Card>

          {/* Inventory Health */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={Package}
                title="Inventory Health"
                sub="Low stock items requiring attention"
              />
            </CardHeader>
            <CardContent className="p-0">
              {lowStockItems.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  ✅ All items are sufficiently stocked
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Threshold</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockItems.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {(p.categories as any)?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {p.stock_quantity}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {p.low_stock_threshold}
                        </TableCell>
                        <TableCell>
                          {p.stock_quantity === 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              Out of Stock
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
                              Low Stock
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Cashier Performance ─────────────────────────────────────────── */}
        <TabsContent value="cashier" className="space-y-4 mt-4">
          {/* Summary KPI */}
          {cashierPerf.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {cashierPerf.slice(0, 4).map((c, i) => (
                <div
                  key={c.fullName}
                  className={`p-3 rounded-xl border space-y-1 ${i === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "bg-muted/20"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">
                      #{i + 1} {c.name}
                    </p>
                    {i === 0 && (
                      <Badge className="bg-emerald-500/20 text-emerald-600 text-xs border-0">
                        Top
                      </Badge>
                    )}
                  </div>
                  <p className="text-base font-bold text-emerald-500">
                    {formatPeso(c.revenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.txCount} tx · avg {formatPeso(c.avgOrder)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={Users}
                title="Revenue per Cashier"
                sub="Total sales attributed to each employee"
              />
            </CardHeader>
            <CardContent>
              {cashierPerf.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  No data for this period
                </p>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashierPerf} barCategoryGap="35%">
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="name" tick={axisStyle} />
                      <YAxis
                        tick={axisStyle}
                        tickFormatter={(v) =>
                          `₱${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                        }
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, n) =>
                          n === "revenue"
                            ? [formatPeso(Number(v)), "Revenue"]
                            : [v, "Transactions"]
                        }
                      />
                      <Legend
                        formatter={(v) => (
                          <span style={{ color: "#9ca3af", fontSize: 11 }}>
                            {v === "revenue" ? "Revenue" : "Avg Order"}
                          </span>
                        )}
                      />
                      <Bar
                        dataKey="revenue"
                        name="revenue"
                        radius={[5, 5, 0, 0]}
                      >
                        {cashierPerf.map((_, i) => (
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

          {/* Avg Order Value comparison */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={ShoppingBasket}
                title="Average Order Value per Cashier"
                sub="Who sells better — not just who sells more"
              />
            </CardHeader>
            <CardContent>
              {cashierPerf.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  No data
                </p>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashierPerf} barCategoryGap="40%">
                      <CartesianGrid {...gridStyle} />
                      <XAxis dataKey="name" tick={axisStyle} />
                      <YAxis tick={axisStyle} tickFormatter={(v) => `₱${v}`} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v) => [
                          formatPeso(Number(v)),
                          "Avg Order Value",
                        ]}
                      />
                      <Bar
                        dataKey="avgOrder"
                        name="avgOrder"
                        radius={[5, 5, 0, 0]}
                      >
                        {cashierPerf.map((_, i) => (
                          <Cell
                            key={i}
                            fill={[C.violet, C.sky, C.pink, C.lime][i % 4]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Radar — 3+ cashiers */}
          {cashierRadar.length >= 3 && (
            <Card>
              <CardHeader className="pb-2">
                <SectionHeader
                  icon={BarChart3}
                  title="Performance Radar"
                  sub="Normalised scores — higher = better relative performance"
                />
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={cashierRadar}>
                      <PolarGrid stroke="#1f2937" />
                      <PolarAngleAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <Radar
                        name="Revenue %"
                        dataKey="Revenue"
                        stroke={C.emerald}
                        fill={C.emerald}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Radar
                        name="Transactions %"
                        dataKey="Transactions"
                        stroke={C.indigo}
                        fill={C.indigo}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Radar
                        name="Avg Order %"
                        dataKey="AvgOrder"
                        stroke={C.amber}
                        fill={C.amber}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Legend
                        formatter={(v) => (
                          <span style={{ color: "#9ca3af", fontSize: 11 }}>
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
              </CardContent>
            </Card>
          )}

          {/* Detail table */}
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
                    <TableRow key={c.fullName}>
                      <TableCell className="text-muted-foreground font-medium">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.fullName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {c.role}
                        </Badge>
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

        {/* ── 4. Products ───────────────────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-4 mt-4">
          {/* Top Products */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={Package}
                title="Top Products by Revenue"
                sub={`Best sellers in the last ${period} days`}
              />
            </CardHeader>
            <CardContent>
              {topProductsData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  No data for this period
                </p>
              ) : (
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topProductsData}
                      layout="vertical"
                      barCategoryGap="18%"
                    >
                      <CartesianGrid {...gridStyle} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={axisStyle}
                        tickFormatter={(v) =>
                          `₱${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                        }
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={130}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, n) =>
                          n === "revenue"
                            ? [formatPeso(Number(v)), "Revenue"]
                            : [v, "Units Sold"]
                        }
                      />
                      <Legend
                        formatter={(v) => (
                          <span style={{ color: "#9ca3af", fontSize: 11 }}>
                            {v === "revenue" ? "Revenue" : "Units Sold"}
                          </span>
                        )}
                      />
                      <Bar
                        dataKey="revenue"
                        name="revenue"
                        radius={[0, 6, 6, 0]}
                      >
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

          {/* Slow Moving + Dead Stock */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={TrendingDown}
                title="Slow-Moving & Dead Stock"
                sub="Products with fewer than 5 sales in 30 days"
              />
            </CardHeader>
            <CardContent>
              {slowMoving.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  ✅ All products are moving well
                </p>
              ) : (
                <>
                  <div className="h-[280px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={slowMoving.slice(0, 10)}
                        layout="vertical"
                        barCategoryGap="20%"
                        barGap={4}
                      >
                        <CartesianGrid {...gridStyle} horizontal={false} />
                        <XAxis type="number" tick={axisStyle} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={130}
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                        />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(v, n) =>
                            n === "stockValue"
                              ? [formatPeso(Number(v)), "Stock Value"]
                              : [`${v} units`, "30d Sales"]
                          }
                        />
                        <Legend
                          formatter={(v) => (
                            <span style={{ color: "#9ca3af", fontSize: 11 }}>
                              {v === "stockValue"
                                ? "Stock Value (₱)"
                                : "30-day Sales (units)"}
                            </span>
                          )}
                        />
                        <Bar
                          dataKey="stockValue"
                          fill={C.amber}
                          name="stockValue"
                          radius={[0, 4, 4, 0]}
                          fillOpacity={0.85}
                        />
                        <Bar
                          dataKey="sales30d"
                          fill={C.indigo}
                          name="sales30d"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
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
                          <TableCell className="text-muted-foreground text-sm">
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
                              <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-xs">
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

        {/* ── 5. Discounts, Refunds & Waste ─────────────────────────────────── */}
        <TabsContent value="impact" className="space-y-4 mt-4">
          {/* KPI Row */}
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
                sub: `${refundCount} orders · ${refundRate.toFixed(1)}% rate`,
                color: "text-rose-500",
              },
              {
                label: "Waste Loss",
                value: formatPeso(totalWasteLoss),
                sub: `${disposedItems.reduce((s, d) => s + d.quantity, 0)} units disposed`,
                color: "text-rose-500",
              },
            ].map((k) => (
              <div key={k.label} className="p-3 rounded-xl border bg-muted/20">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Discount effectiveness */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={Percent}
                title="Discount Effectiveness"
                sub="Sales with vs without discounts"
              />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {[
                    {
                      label: "Regular Sales",
                      value: regularRevenue,
                      total: totalRevenue,
                      color: C.emerald,
                    },
                    {
                      label: "Discounted Sales",
                      value: discountedRevenue,
                      total: totalRevenue,
                      color: C.amber,
                    },
                    {
                      label: "Total Discounts Given",
                      value: totalDiscounts,
                      total: totalRevenue,
                      color: C.rose,
                    },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="font-medium">
                          {formatPeso(item.value)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {item.total > 0
                          ? ((item.value / item.total) * 100).toFixed(1)
                          : 0}
                        % of revenue
                      </p>
                    </div>
                  ))}
                </div>

                {impactPieData.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={impactPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
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
                          formatter={(v, n) => [
                            formatPeso(Number(v)),
                            n as string,
                          ]}
                        />
                        <Legend
                          formatter={(v) => (
                            <span style={{ color: "#9ca3af", fontSize: 10 }}>
                              {v}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground text-sm">
                    No impact data
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Daily Refunds */}
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader
                icon={RotateCcw}
                title="Daily Refund Trend"
                sub={`${refundRate.toFixed(1)}% overall refund rate this period`}
              />
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend} barCategoryGap="40%">
                    <CartesianGrid {...gridStyle} />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis tick={axisStyle} tickFormatter={(v) => `₱${v}`} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v) => [formatPeso(Number(v)), "Refunds"]}
                    />
                    <Bar
                      dataKey="refunds"
                      fill={C.rose}
                      radius={[4, 4, 0, 0]}
                      name="Refunds"
                    >
                      {dailyTrend.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.refunds > 0 ? C.rose : "#1f2937"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Discount audit */}
          {[...pwdTx, ...seniorTx, ...nearExpiryTx].length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <SectionHeader
                  icon={AlertTriangle}
                  title="Discount Audit Trail"
                />
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[280px] overflow-y-auto">
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
                                className={`text-xs ${tx.discount_type === "pwd" ? "bg-teal-600/20 text-teal-500" : tx.discount_type === "senior" ? "bg-indigo-600/20 text-indigo-400" : "bg-amber-600/20 text-amber-500"}`}
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

          {/* Disposed items */}
          {disposedItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <SectionHeader
                  icon={AlertTriangle}
                  title="Disposed / Wasted Items"
                />
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
                        <TableCell className="text-right text-rose-500 font-medium">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

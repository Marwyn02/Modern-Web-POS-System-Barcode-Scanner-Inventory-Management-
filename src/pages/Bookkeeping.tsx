/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Receipt,
  TrendingDown,
  Package,
  Users,
  FileText,
  Download,
  RotateCcw,
  Eye,
  Printer,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  getMonth,
  getYear,
} from "date-fns";
import { useNavigate } from "react-router-dom";

const BK_PAGE_SIZE = 10;

export default function Bookkeeping() {
  const today = new Date();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(format(today, "yyyy-MM"));
  const [dailyDetailDate, setDailyDetailDate] = useState<string | null>(null);
  const [dailyPage, setDailyPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [slowMovingPage, setSlowMovingPage] = useState(1);
  const [vatPage, setVatPage] = useState(1);
  const [refundsPage, setRefundsPage] = useState(1);
  const [discountsPage, setDiscountsPage] = useState(1);
  const [disposedPage, setDisposedPage] = useState(1);

  const dailyReportRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(new Date(selectedMonth + "-01"));
  const monthEnd = endOfMonth(monthStart);
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  useEffect(() => {
    setDailyPage(1);
    setVatPage(1);
    setRefundsPage(1);
    setDiscountsPage(1);
    setDisposedPage(1);
  }, [selectedMonth]);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: disposedItems } = useQuery({
    queryKey: ["bk-disposed", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("disposed_items")
        .select("*, products(name)")
        .gte("disposed_at", startOfDay(monthStart).toISOString())
        .lte("disposed_at", endOfDay(monthEnd).toISOString());
      return data || [];
    },
  });

  const { data: todayTx } = useQuery({
    queryKey: ["bk-today-tx"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: monthTx } = useQuery({
    queryKey: ["bk-month-tx", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", startOfDay(monthStart).toISOString())
        .lte("created_at", endOfDay(monthEnd).toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: monthRefunds } = useQuery({
    queryKey: ["bk-month-refunds", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", startOfDay(monthStart).toISOString())
        .lte("created_at", endOfDay(monthEnd).toISOString())
        .eq("status", "refunded")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: todayRefunds } = useQuery({
    queryKey: ["bk-today-refunds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .eq("status", "refunded");
      return data || [];
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["bk-top-products", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_items")
        .select("product_id, quantity, subtotal, products(name)")
        .gte("created_at", startOfDay(monthStart).toISOString())
        .lte("created_at", endOfDay(monthEnd).toISOString());
      if (!data) return [];
      const map = new Map<
        string,
        { name: string; qty: number; revenue: number }
      >();
      data.forEach((item) => {
        const name = (item.products as any)?.name || "Unknown";
        const existing = map.get(item.product_id!) || {
          name,
          qty: 0,
          revenue: 0,
        };
        existing.qty += item.quantity;
        existing.revenue += Number(item.subtotal);
        map.set(item.product_id!, existing);
      });
      return Array.from(map.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["bk-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("name, stock_quantity, low_stock_threshold, categories(name)")
        .eq("is_active", true)
        .order("stock_quantity", { ascending: true })
        .limit(20);
      return (data || []).filter(
        (p) => p.stock_quantity <= p.low_stock_threshold,
      );
    },
  });

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const { data: slowMoving } = useQuery({
    queryKey: ["bk-slow-moving"],
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
        .slice(0, 15);
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["bk-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role, user_id")
        .eq("is_active", true);
      return data || [];
    },
  });

  const { data: employeeMap } = useQuery({
    queryKey: ["bk-employee-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("user_id, name")
        .not("user_id", "is", null);
      const map: Record<string, string> = {};
      (data || []).forEach((e) => {
        if (e.user_id) map[e.user_id] = e.name;
      });
      return map;
    },
  });

  const { data: dailyLogs } = useQuery({
    queryKey: ["bk-daily-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*")
        .order("log_date", { ascending: false })
        .limit(60);
      return data || [];
    },
  });

  const { data: monthlyLogs } = useQuery({
    queryKey: ["bk-monthly-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_logs")
        .select("*")
        .order("log_year", { ascending: false })
        .order("log_month", { ascending: false })
        .limit(24);
      return data || [];
    },
  });

  const { data: shiftLogs } = useQuery({
    queryKey: ["bk-shift-logs", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*, employees(name, role)")
        .gte("clock_in", startOfDay(monthStart).toISOString())
        .lte("clock_in", endOfDay(monthEnd).toISOString())
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: false });
      return data || [];
    },
  });

  const todayDateStr = format(today, "yyyy-MM-dd");
  const todayLog = (dailyLogs || []).find((l) => l.log_date === todayDateStr);
  const thisMonthLog = (monthlyLogs || []).find(
    (l) =>
      l.log_year === getYear(monthStart) &&
      l.log_month === getMonth(monthStart) + 1,
  );

  // ── Derived calcs ──────────────────────────────────────────────────────────
  const todayRevenue = (todayTx || []).reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const todayVat = (todayTx || []).reduce(
    (s, t) => s + Number(t.vat_amount),
    0,
  );
  const todayNet = todayRevenue - todayVat;
  const todayCash = (todayTx || [])
    .filter((t) => t.payment_method === "cash")
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const todayCard = (todayTx || [])
    .filter((t) => t.payment_method === "card")
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const todayRefundTotal = (todayRefunds || []).reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const todayDiscounts = (todayTx || []).filter((t) => t.discount_type);
  const todayDiscountTotal = todayDiscounts.reduce(
    (s, t) => s + Number(t.discount_amount),
    0,
  );

  const monthRevenue = (monthTx || []).reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const monthVat = (monthTx || []).reduce(
    (s, t) => s + Number(t.vat_amount),
    0,
  );
  const monthNet = monthRevenue - monthVat;
  const monthRefundTotal = (monthRefunds || []).reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const monthRefundVat = (monthRefunds || []).reduce(
    (s, t) => s + Number(t.vat_amount),
    0,
  );
  const monthDiscountTotal = (monthTx || [])
    .filter((t) => t.discount_type)
    .reduce((s, t) => s + Number(t.discount_amount), 0);
  const monthWasteLoss = (disposedItems || []).reduce(
    (s, d) => s + Number(d.total_loss),
    0,
  );

  const cashierPerf = (employees || [])
    .map((emp) => {
      const empTx = (monthTx || []).filter(
        (t) => emp.user_id && t.employee_id === emp.user_id,
      );
      return {
        name: emp.name,
        role: emp.role,
        txCount: empTx.length,
        revenue: empTx.reduce((s, t) => s + Number(t.total_amount), 0),
      };
    })
    .filter((c) => c.txCount > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const dailyBreakdown = (() => {
    const map = new Map<
      string,
      {
        date: string;
        revenue: number;
        vat: number;
        txCount: number;
        refunds: number;
      }
    >();
    (monthTx || []).forEach((tx) => {
      const day = format(new Date(tx.created_at), "yyyy-MM-dd");
      const e = map.get(day) || {
        date: day,
        revenue: 0,
        vat: 0,
        txCount: 0,
        refunds: 0,
      };
      e.revenue += Number(tx.total_amount);
      e.vat += Number(tx.vat_amount);
      e.txCount += 1;
      map.set(day, e);
    });
    (monthRefunds || []).forEach((tx) => {
      const day = format(new Date(tx.created_at), "yyyy-MM-dd");
      const e = map.get(day) || {
        date: day,
        revenue: 0,
        vat: 0,
        txCount: 0,
        refunds: 0,
      };
      e.refunds += Number(tx.total_amount);
      map.set(day, e);
    });
    return Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  })();

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(today, i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const exportCSV = (data: Record<string, any>[], filename: string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [
      keys.join(","),
      ...data.map((r) => keys.map((k) => `"${r[k]}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const BkPagination = ({
    page,
    setPage,
    total,
  }: {
    page: number;
    setPage: (p: number) => void;
    total: number;
  }) => {
    const totalPages = Math.ceil(total / BK_PAGE_SIZE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <p className="text-sm text-muted-foreground">
          {(page - 1) * BK_PAGE_SIZE + 1}–{Math.min(page * BK_PAGE_SIZE, total)}{" "}
          of {total}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
            )
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
                acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span
                  key={`e-${i}`}
                  className="px-1 text-sm text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={page === p ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </Button>
              ),
            )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const pagedDailyBreakdown = dailyBreakdown.slice(
    (dailyPage - 1) * BK_PAGE_SIZE,
    dailyPage * BK_PAGE_SIZE,
  );
  const pagedVat = dailyBreakdown.slice(
    (vatPage - 1) * BK_PAGE_SIZE,
    vatPage * BK_PAGE_SIZE,
  );
  const pagedLowStock = (lowStock || []).slice(
    (lowStockPage - 1) * BK_PAGE_SIZE,
    lowStockPage * BK_PAGE_SIZE,
  );
  const pagedSlowMoving = (slowMoving || []).slice(
    (slowMovingPage - 1) * BK_PAGE_SIZE,
    slowMovingPage * BK_PAGE_SIZE,
  );
  const pagedRefunds = (monthRefunds || []).slice(
    (refundsPage - 1) * BK_PAGE_SIZE,
    refundsPage * BK_PAGE_SIZE,
  );
  const discountedTx = (monthTx || []).filter((t) => t.discount_type);
  const pagedDiscounts = discountedTx.slice(
    (discountsPage - 1) * BK_PAGE_SIZE,
    discountsPage * BK_PAGE_SIZE,
  );
  const pagedDisposed = (disposedItems || []).slice(
    (disposedPage - 1) * BK_PAGE_SIZE,
    disposedPage * BK_PAGE_SIZE,
  );

  const fmt = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookkeeping</h1>
          <p className="text-muted-foreground">Financial records & reports</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Close status banners */}
      <div className="flex flex-wrap gap-2">
        {todayLog ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Today closed — {format(new Date(todayLog.created_at), "h:mm a")}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
            <XCircle className="h-3.5 w-3.5" />
            Today not yet closed — use the sidebar to close the day
          </div>
        )}
        {thisMonthLog ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {format(monthStart, "MMMM yyyy")} month closed
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" />
            {format(monthStart, "MMMM yyyy")} not yet closed
          </div>
        )}
      </div>

      {/* Today's summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          {
            title: "Today's Revenue",
            value: `₱${todayRevenue.toFixed(2)}`,
            sub: `${todayTx?.length || 0} transactions`,
            icon: DollarSign,
            color: "text-success",
          },
          {
            title: "Cash Sales",
            value: `₱${todayCash.toFixed(2)}`,
            icon: DollarSign,
          },
          {
            title: "Card Sales",
            value: `₱${todayCard.toFixed(2)}`,
            icon: DollarSign,
          },
          {
            title: "Today's VAT",
            value: `₱${todayVat.toFixed(2)}`,
            sub: `Net: ₱${todayNet.toFixed(2)}`,
            icon: FileText,
          },
          {
            title: "Today's Refunds",
            value: `₱${todayRefundTotal.toFixed(2)}`,
            sub: `${todayRefunds?.length || 0} refunded`,
            icon: RotateCcw,
            color: "text-destructive",
          },
          {
            title: "Discounts Given",
            value: `₱${todayDiscountTotal.toFixed(2)}`,
            sub: `${todayDiscounts.length} discounted`,
            icon: FileText,
            color: "text-warning",
          },
        ].map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <card.icon className="h-4 w-4" /> {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${card.color || ""}`}>
                {card.value}
              </p>
              {card.sub && (
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="tabs-scroll flex w-full overflow-x-auto scrollbar-none h-auto p-1 justify-start">
          <TabsTrigger value="summary" className="shrink-0">
            <FileText className="h-4 w-4 mr-1" /> Financial Summary
          </TabsTrigger>
          <TabsTrigger value="daily" className="shrink-0">
            <Receipt className="h-4 w-4 mr-1" /> Daily Sales
          </TabsTrigger>
          <TabsTrigger value="top" className="shrink-0">
            <Package className="h-4 w-4 mr-1" /> Top Products
          </TabsTrigger>
          <TabsTrigger value="stock" className="shrink-0">
            <Package className="h-4 w-4 mr-1" /> Stock Health
          </TabsTrigger>
          <TabsTrigger value="cashier" className="shrink-0">
            <Users className="h-4 w-4 mr-1" /> Cashier Performance
          </TabsTrigger>
          <TabsTrigger value="vat" className="shrink-0">
            <FileText className="h-4 w-4 mr-1" /> VAT Report
          </TabsTrigger>
          <TabsTrigger value="deductions" className="shrink-0">
            <AlertTriangle className="h-4 w-4 mr-1" /> Refunds & Discounts
          </TabsTrigger>
          <TabsTrigger value="logs" className="shrink-0">
            <BookOpen className="h-4 w-4 mr-1" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* ── Financial Summary ── */}
        <TabsContent value="summary">
          <FinancialSummaryTab
            selectedMonth={selectedMonth}
            monthStart={monthStart}
            monthTx={monthTx || []}
            monthRefunds={monthRefunds || []}
            todayTx={todayTx || []}
            todayRefunds={todayRefunds || []}
            disposedItems={disposedItems || []}
            employees={employees || []}
            exportCSV={exportCSV}
          />
        </TabsContent>

        {/* ── Daily Sales ── */}
        <TabsContent value="daily" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: "Gross Revenue",
                value: `₱${monthRevenue.toFixed(2)}`,
                color: "text-success",
              },
              {
                label: "Total VAT",
                value: `₱${monthVat.toFixed(2)}`,
                color: "",
              },
              {
                label: "Net Revenue",
                value: `₱${monthNet.toFixed(2)}`,
                color: "",
              },
              {
                label: "Refunds",
                value: `₱${monthRefundTotal.toFixed(2)}`,
                color: "text-destructive",
              },
              {
                label: "Transactions",
                value: String(monthTx?.length || 0),
                color: "",
              },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">
                  {format(monthStart, "MMMM yyyy")}
                </p>
              </div>
            ))}
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Daily Breakdown — {format(monthStart, "MMMM yyyy")}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportCSV(
                    dailyBreakdown.map((d) => ({
                      Date: d.date,
                      Revenue: d.revenue.toFixed(2),
                      VAT: d.vat.toFixed(2),
                      Net: (d.revenue - d.vat).toFixed(2),
                      Transactions: d.txCount,
                      Refunds: d.refunds.toFixed(2),
                    })),
                    `daily-sales-${selectedMonth}.csv`,
                  )
                }
              >
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Refunds</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDailyBreakdown.map((d) => (
                    <TableRow
                      key={d.date}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDailyDetailDate(d.date)}
                    >
                      <TableCell>
                        {format(new Date(d.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">{d.txCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₱{d.revenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {d.refunds > 0 ? `₱${d.refunds.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ₱{d.vat.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₱{(d.revenue - d.vat).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDailyDetailDate(d.date);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pagedDailyBreakdown.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <BkPagination
                page={dailyPage}
                setPage={setDailyPage}
                total={dailyBreakdown.length}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Top Products ── */}
        <TabsContent value="top">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Top Selling Products — {format(monthStart, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts?.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.qty}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₱{p.revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!topProducts || topProducts.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
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

        {/* ── Stock Health ── */}
        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> Low Stock Alert
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedLowStock.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {(p.categories as any)?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.stock_quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.low_stock_threshold}
                      </TableCell>
                      <TableCell>
                        {p.stock_quantity === 0 ? (
                          <Badge variant="destructive">Out of Stock</Badge>
                        ) : (
                          <Badge className="bg-warning text-warning-foreground">
                            Low
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!pagedLowStock || pagedLowStock.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-muted-foreground"
                      >
                        All stocked up!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <BkPagination
                page={lowStockPage}
                setPage={setLowStockPage}
                total={lowStock?.length || 0}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4" /> Slow-Moving Stock
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {"<"}5 sales in 30 days
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">In Stock</TableHead>
                    <TableHead className="text-right">30d Sales</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedSlowMoving.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {(p.categories as any)?.name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.stock_quantity}
                      </TableCell>
                      <TableCell className="text-right">{p.sales30d}</TableCell>
                      <TableCell className="text-right">
                        ₱{p.stockValue.toFixed(2)}
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
                  {(!pagedSlowMoving || pagedSlowMoving.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-6 text-muted-foreground"
                      >
                        All products are moving well
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <BkPagination
                page={slowMovingPage}
                setPage={setSlowMovingPage}
                total={slowMoving?.length || 0}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cashier Performance ── */}
        <TabsContent value="cashier">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Cashier Performance — {format(monthStart, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashierPerf.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{c.txCount}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₱{c.revenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ₱
                        {c.txCount
                          ? (c.revenue / c.txCount).toFixed(2)
                          : "0.00"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {cashierPerf.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
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

        {/* ── VAT Report ── */}
        <TabsContent value="vat">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                VAT Report — {format(monthStart, "MMMM yyyy")}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportCSV(
                    dailyBreakdown.map((d) => ({
                      Date: d.date,
                      "Gross Sales": d.revenue.toFixed(2),
                      "VAT Amount": d.vat.toFixed(2),
                      "Net Sales": (d.revenue - d.vat).toFixed(2),
                      Refunds: d.refunds.toFixed(2),
                    })),
                    `vat-report-${selectedMonth}.csv`,
                  )
                }
              >
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Total Gross Sales",
                    value: `₱${monthRevenue.toFixed(2)}`,
                  },
                  {
                    label: "Total VAT (12%)",
                    value: `₱${monthVat.toFixed(2)}`,
                  },
                  {
                    label: "Total Net Sales",
                    value: `₱${monthNet.toFixed(2)}`,
                  },
                  {
                    label: "Refund VAT Adj.",
                    value: `₱${monthRefundVat.toFixed(2)}`,
                    color: "text-destructive",
                  },
                ].map((s) => (
                  <div key={s.label} className="space-y-1">
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p
                      className={`text-xl font-bold ${(s as any).color || ""}`}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Gross Sales</TableHead>
                    <TableHead className="text-right">VAT (12%)</TableHead>
                    <TableHead className="text-right">Net Sales</TableHead>
                    <TableHead className="text-right">Refunds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedVat.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>
                        {format(new Date(d.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        ₱{d.revenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ₱{d.vat.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₱{(d.revenue - d.vat).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {d.refunds > 0 ? `₱${d.refunds.toFixed(2)}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {pagedVat.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <BkPagination
                page={vatPage}
                setPage={setVatPage}
                total={dailyBreakdown.length}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Refunds & Discounts ── */}
        <TabsContent value="deductions" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Total Refunds",
                value: `₱${monthRefundTotal.toFixed(2)}`,
                sub: `${monthRefunds?.length || 0} transactions`,
                color: "text-destructive",
              },
              {
                label: "PWD/Senior Discounts",
                value: `₱${monthDiscountTotal.toFixed(2)}`,
                sub: `${(monthTx || []).filter((t) => t.discount_type).length} transactions`,
                color: "text-warning",
              },
              {
                label: "Expiry Waste Loss",
                value: `₱${monthWasteLoss.toFixed(2)}`,
                sub: `${(disposedItems || []).reduce((s, d) => s + d.quantity, 0)} units disposed`,
                color: "text-destructive",
              },
              {
                label: "Net Adj. Revenue",
                value: `₱${(monthRevenue - monthRefundTotal - monthWasteLoss).toFixed(2)}`,
                sub: "after refunds & waste",
                color: "",
              },
            ].map((k) => (
              <div key={k.label} className="p-3 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Refund Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pagedRefunds && pagedRefunds.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRefunds.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">
                          {tx.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(tx.created_at),
                            "MMM d, yyyy h:mm a",
                          )}
                        </TableCell>
                        <TableCell>
                          {employeeMap?.[tx.employee_id ?? ""] || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{tx.payment_method}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          ₱{Number(tx.total_amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No refunds this month
                </p>
              )}
              <BkPagination
                page={refundsPage}
                setPage={setRefundsPage}
                total={monthRefunds?.length || 0}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                PWD / Senior Discounts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {discountedTx.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer ID</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedDiscounts.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">
                          {tx.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(tx.created_at),
                            "MMM d, yyyy h:mm a",
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {tx.discount_type?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.customer_id_number || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          ₱{Number(tx.original_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-warning">
                          -₱{Number(tx.discount_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₱{Number(tx.total_amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No discounts this month
                </p>
              )}
              <BkPagination
                page={discountsPage}
                setPage={setDiscountsPage}
                total={discountedTx.length}
              />
            </CardContent>
          </Card>
          {pagedDisposed && pagedDisposed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />{" "}
                  Disposed / Expired Items
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Loss</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedDisposed.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {(d.products as any)?.name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          {d.quantity}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          ₱{Number(d.total_loss).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(d.disposed_at!), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <BkPagination
                  page={disposedPage}
                  setPage={setDisposedPage}
                  total={disposedItems?.length || 0}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Logs ── */}
        <TabsContent value="logs" className="space-y-4">
          <Tabs defaultValue="daily-logs">
            <TabsList className="mb-4">
              <TabsTrigger
                value="daily-logs"
                className="flex items-center gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" /> Daily Logs
              </TabsTrigger>
              <TabsTrigger
                value="monthly-logs"
                className="flex items-center gap-1.5"
              >
                <Layers className="h-3.5 w-3.5" /> Monthly Logs
              </TabsTrigger>
              <TabsTrigger
                value="shift-logs"
                className="flex items-center gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" /> Shift Logs
              </TabsTrigger>
            </TabsList>

            {/* ── Daily Logs ── */}
            <TabsContent value="daily-logs" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Official daily closing records. Click any row to view the full
                  summary.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      (dailyLogs || []).map((l) => ({
                        Date: l.log_date,
                        "Total Sales": l.total_sales,
                        Transactions: l.transaction_count,
                        VAT: l.vat_amount,
                        Discounts: l.discount_amount,
                        Refunds: l.refund_amount,
                        "Cash Sales": l.cash_sales,
                        "Card Sales": l.card_sales,
                        "Stock Loss": l.stock_loss,
                        "Net Profit": l.net_profit,
                      })),
                      "daily-logs.csv",
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Tx</TableHead>
                        <TableHead className="text-right">Cash</TableHead>
                        <TableHead className="text-right">Card</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                        <TableHead className="text-right">Refunds</TableHead>
                        <TableHead className="text-right">Stock Loss</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead>Closed</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(dailyLogs || []).map((log) => (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50 group"
                          onClick={() => navigate(`/logs/${log.id}?type=daily`)}
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(new Date(log.log_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right text-success font-medium">
                            {fmt(Number(log.total_sales))}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.transaction_count}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(Number(log.cash_sales))}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(Number(log.card_sales))}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {fmt(Number(log.vat_amount))}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {Number(log.refund_amount) > 0
                              ? fmt(Number(log.refund_amount))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {Number(log.stock_loss) > 0
                              ? fmt(Number(log.stock_loss))
                              : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-bold ${Number(log.net_profit) >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {fmt(Number(log.net_profit))}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "h:mm a")}
                          </TableCell>
                          <TableCell>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!dailyLogs || dailyLogs.length === 0) && (
                        <TableRow>
                          <TableCell
                            colSpan={11}
                            className="text-center py-10 text-muted-foreground"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">No daily logs yet</p>
                              <p className="text-xs">
                                Close the day from the sidebar to create the
                                first official daily record
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Monthly Logs ── */}
            <TabsContent value="monthly-logs" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Official monthly closing records. Click any row to view the
                  full summary.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCSV(
                      (monthlyLogs || []).map((l) => ({
                        Year: l.log_year,
                        Month: l.log_month,
                        "Total Sales": l.total_sales,
                        Transactions: l.transaction_count,
                        VAT: l.vat_amount,
                        Discounts: l.discount_amount,
                        Refunds: l.refund_amount,
                        "Cash Sales": l.cash_sales,
                        "Card Sales": l.card_sales,
                        "Stock Loss": l.stock_loss,
                        "Net Profit": l.net_profit,
                      })),
                      "monthly-logs.csv",
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Tx</TableHead>
                        <TableHead className="text-right">Cash</TableHead>
                        <TableHead className="text-right">Card</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                        <TableHead className="text-right">Refunds</TableHead>
                        <TableHead className="text-right">Stock Loss</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead>Closed</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(monthlyLogs || []).map((log) => (
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50 group"
                          onClick={() =>
                            navigate(`/logs/${log.id}?type=monthly`)
                          }
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(
                              new Date(log.log_year, log.log_month - 1, 1),
                              "MMMM yyyy",
                            )}
                          </TableCell>
                          <TableCell className="text-right text-success font-medium">
                            {fmt(Number(log.total_sales))}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.transaction_count}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(Number(log.cash_sales))}
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(Number(log.card_sales))}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {fmt(Number(log.vat_amount))}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {Number(log.refund_amount) > 0
                              ? fmt(Number(log.refund_amount))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {Number(log.stock_loss) > 0
                              ? fmt(Number(log.stock_loss))
                              : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-bold ${Number(log.net_profit) >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {fmt(Number(log.net_profit))}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "MMM d, h:mm a")}
                          </TableCell>
                          <TableCell>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!monthlyLogs || monthlyLogs.length === 0) && (
                        <TableRow>
                          <TableCell
                            colSpan={11}
                            className="text-center py-10 text-muted-foreground"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">No monthly logs yet</p>
                              <p className="text-xs">
                                Close the month from the sidebar to create the
                                first official monthly record
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Shift Logs ── */}
            <TabsContent value="shift-logs" className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Cashier shift records for {format(monthStart, "MMMM yyyy")} —
                  click any row to view the full shift report.
                </p>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cashier</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">
                          Starting Cash
                        </TableHead>
                        <TableHead className="text-right">
                          Ending Cash
                        </TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(shiftLogs || []).map((shift) => {
                        const emp = shift.employees as any;
                        const durationMins = shift.clock_out
                          ? Math.round(
                              (new Date(shift.clock_out).getTime() -
                                new Date(shift.clock_in).getTime()) /
                                60000,
                            )
                          : 0;
                        const hrs = Math.floor(durationMins / 60);
                        const mins = durationMins % 60;
                        const diff = Number(shift.cash_difference || 0);
                        const isBalanced = Math.abs(diff) < 0.01;
                        const isActive = !shift.clock_out;
                        return (
                          <TableRow
                            key={shift.id}
                            className={`group transition-colors ${isActive ? "opacity-60" : "cursor-pointer hover:bg-muted/50"}`}
                            onClick={() => {
                              if (!isActive)
                                navigate(`/shift-report/${shift.id}`);
                            }}
                            title={
                              isActive
                                ? "Shift still in progress — report available after clock-out"
                                : "Click to view shift report"
                            }
                          >
                            <TableCell className="font-medium">
                              {emp?.name || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {emp?.role || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(
                                new Date(shift.clock_in),
                                "MMM d, h:mm a",
                              )}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {shift.clock_out ? (
                                format(new Date(shift.clock_out), "h:mm a")
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {hrs > 0 ? `${hrs}h ` : ""}
                              {mins}m
                            </TableCell>
                            <TableCell className="text-right">
                              {shift.starting_cash != null
                                ? fmt(Number(shift.starting_cash))
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {shift.ending_cash != null
                                ? fmt(Number(shift.ending_cash))
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {shift.expected_cash != null
                                ? fmt(Number(shift.expected_cash))
                                : "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${isBalanced ? "text-success" : diff > 0 ? "text-warning" : "text-destructive"}`}
                            >
                              {shift.cash_difference != null
                                ? (diff >= 0 ? "+" : "") + fmt(diff)
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {shift.ending_cash != null ? (
                                isBalanced ? (
                                  <Badge className="bg-success/10 text-success border-success/20 text-xs">
                                    Balanced
                                  </Badge>
                                ) : diff > 0 ? (
                                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                                    Over
                                  </Badge>
                                ) : (
                                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                                    Short
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {!isActive && (
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!shiftLogs || shiftLogs.length === 0) && (
                        <TableRow>
                          <TableCell
                            colSpan={11}
                            className="text-center py-10 text-muted-foreground"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">
                                No shift logs for this month
                              </p>
                              <p className="text-xs">
                                Shifts are recorded when cashiers start and end
                                their shift from the sidebar
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <DailyDetailDialog
        date={dailyDetailDate}
        onClose={() => setDailyDetailDate(null)}
        reportRef={dailyReportRef}
        exportCSV={exportCSV}
      />
    </div>
  );
}

// ── DailyDetailDialog (unchanged) ─────────────────────────────────────────────
function DailyDetailDialog({
  date,
  onClose,
  reportRef,
  exportCSV,
}: {
  date: string | null;
  onClose: () => void;
  reportRef: React.RefObject<HTMLDivElement | null>;
  exportCSV: (data: Record<string, any>[], filename: string) => void;
}) {
  const { data: dayTx } = useQuery({
    queryKey: ["bk-day-detail", date],
    enabled: !!date,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", startOfDay(new Date(date!)).toISOString())
        .lte("created_at", endOfDay(new Date(date!)).toISOString())
        .order("created_at", { ascending: true });
      return data || [];
    },
  });
  const { data: empMap } = useQuery({
    queryKey: ["dialog-emp-map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("user_id, name")
        .not("user_id", "is", null);
      const map: Record<string, string> = {};
      (data || []).forEach((e) => {
        if (e.user_id) map[e.user_id] = e.name;
      });
      return map;
    },
  });
  const { data: dayItems } = useQuery({
    queryKey: ["bk-day-items", date],
    enabled: !!date && (dayTx?.length ?? 0) > 0,
    queryFn: async () => {
      const txIds = dayTx!.map((t) => t.id);
      const { data } = await supabase
        .from("transaction_items")
        .select("*, products(name)")
        .in("transaction_id", txIds);
      return data || [];
    },
  });
  if (!date) return null;
  const completed = (dayTx || []).filter((t) => t.status === "completed");
  const refunded = (dayTx || []).filter((t) => t.status === "refunded");
  const totalRevenue = completed.reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const totalVat = completed.reduce((s, t) => s + Number(t.vat_amount), 0);
  const totalRefunds = refunded.reduce((s, t) => s + Number(t.total_amount), 0);
  const cashTotal = completed
    .filter((t) => t.payment_method === "cash")
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const cardTotal = completed
    .filter((t) => t.payment_method === "card")
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const handlePrint = () => {
    if (!reportRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>Daily Sales Report - ${format(new Date(date), "MMM d, yyyy")}</title><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;max-width:800px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:bold}h2{text-align:center;margin-bottom:4px}</style></head><body>${reportRef.current.innerHTML}<script>window.onload=function(){window.print();window.close()}<\/script></body></html>`,
    );
    w.document.close();
  };
  const handleExportCSV = () => {
    const rows = (dayTx || []).map((tx) => {
      const items = (dayItems || []).filter((i) => i.transaction_id === tx.id);
      return {
        "Transaction ID": tx.id.slice(0, 8),
        Time: format(new Date(tx.created_at), "h:mm a"),
        Payment: tx.payment_method,
        Status: tx.status,
        Items: items
          .map((i) => `${(i.products as any)?.name || "?"} x${i.quantity}`)
          .join("; "),
        VAT: Number(tx.vat_amount).toFixed(2),
        Total: Number(tx.total_amount).toFixed(2),
      };
    });
    exportCSV(rows, `daily-record-${date}.csv`);
  };
  return (
    <Dialog
      open={!!date}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="!max-w-[95vw] md:!max-w-[90vw] w-full max-h-[90vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
            <Receipt className="h-4 w-4 shrink-0" /> Daily Sales Record —{" "}
            {format(new Date(date), "MMMM d, yyyy")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
        <div ref={reportRef}>
          <h2 className="text-center font-bold text-base md:text-lg">
            GroceryPOS — Daily Sales Report
          </h2>
          <p className="text-center text-muted-foreground text-xs md:text-sm mb-4">
            {format(new Date(date), "MMMM d, yyyy (EEEE)")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            {[
              {
                label: "Revenue",
                value: `₱${totalRevenue.toFixed(2)}`,
                color: "text-success",
              },
              {
                label: "Cash / Card",
                value: `₱${cashTotal.toFixed(2)} / ₱${cardTotal.toFixed(2)}`,
                color: "",
              },
              {
                label: "VAT Collected",
                value: `₱${totalVat.toFixed(2)}`,
                color: "",
              },
              {
                label: "Refunds",
                value: `₱${totalRefunds.toFixed(2)}`,
                color: "text-destructive",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="p-2 md:p-3 rounded-lg border bg-muted/30"
              >
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-base md:text-lg font-bold ${s.color}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-md border overflow-hidden">
            <div className="max-h-[250px] md:max-h-[350px] overflow-y-auto overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {[
                      "ID",
                      "Time",
                      "Cashier",
                      "Items",
                      "Payment",
                      "VAT",
                      "Total",
                      "Status",
                    ].map((h) => (
                      <TableHead
                        key={h}
                        className={`text-xs ${["VAT", "Total"].includes(h) ? "text-right" : ""}`}
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dayTx || []).map((tx) => {
                    const items = (dayItems || []).filter(
                      (i) => i.transaction_id === tx.id,
                    );
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">
                          {tx.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(tx.created_at), "h:mm a")}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {empMap?.[tx.employee_id ?? ""] || "—"}
                        </TableCell>
                        <TableCell className="text-xs w-[180px]">
                          {items.map((i) => (
                            <div key={i.id}>
                              {(i.products as any)?.name || "?"} ×{i.quantity} —
                              ₱{Number(i.subtotal).toFixed(2)}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-xs whitespace-nowrap"
                          >
                            {tx.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs whitespace-nowrap">
                          ₱{Number(tx.vat_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium whitespace-nowrap">
                          ₱{Number(tx.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs whitespace-nowrap ${tx.status === "completed" ? "bg-success text-success-foreground" : tx.status === "refunded" ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}`}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(dayTx || []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-4 text-muted-foreground text-xs"
                      >
                        No transactions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="border-t mt-4 pt-3 space-y-1 text-xs md:text-sm">
            {[
              {
                label: "Total Transactions",
                value: `${completed.length} completed, ${refunded.length} refunded`,
                bold: true,
              },
              {
                label: "Gross Revenue",
                value: `₱${totalRevenue.toFixed(2)}`,
                bold: true,
              },
              { label: "Total VAT (12%)", value: `₱${totalVat.toFixed(2)}` },
              {
                label: "Net Revenue",
                value: `₱${(totalRevenue - totalVat).toFixed(2)}`,
              },
            ].map((r) => (
              <div key={r.label} className="flex justify-between">
                <span>{r.label}</span>
                <span className={r.bold ? "font-bold" : ""}>{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-destructive">
              <span>Total Refunds</span>
              <span>₱{totalRefunds.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── FinancialSummaryTab (unchanged from original) ─────────────────────────────
function FinancialSummaryTab({
  monthStart,
  monthTx,
  monthRefunds,
  todayTx,
  todayRefunds,
  disposedItems,
  employees,
  exportCSV,
}: {
  selectedMonth: string;
  monthStart: Date;
  monthTx: any[];
  monthRefunds: any[];
  todayTx: any[];
  todayRefunds: any[];
  disposedItems: any[];
  employees: any[];
  exportCSV: (data: Record<string, any>[], filename: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"daily" | "monthly" | "yearly">(
    "monthly",
  );
  const summaryRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const { data: yearTx } = useQuery({
    queryKey: ["fs-year-tx", today.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", `${today.getFullYear()}-01-01`)
        .lte("created_at", `${today.getFullYear()}-12-31`)
        .eq("status", "completed");
      return data || [];
    },
  });
  const { data: yearRefunds } = useQuery({
    queryKey: ["fs-year-refunds", today.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", `${today.getFullYear()}-01-01`)
        .lte("created_at", `${today.getFullYear()}-12-31`)
        .eq("status", "refunded");
      return data || [];
    },
  });
  const { data: yearDisposed } = useQuery({
    queryKey: ["fs-year-disposed", today.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("disposed_items")
        .select("*, products(name)")
        .gte("disposed_at", `${today.getFullYear()}-01-01`)
        .lte("disposed_at", `${today.getFullYear()}-12-31`);
      return data || [];
    },
  });
  const { data: inventoryData } = useQuery({
    queryKey: ["fs-inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("stock_quantity, cost_price, price")
        .eq("is_active", true);
      return data || [];
    },
  });
  const tx =
    viewMode === "daily"
      ? todayTx
      : viewMode === "monthly"
        ? monthTx
        : yearTx || [];
  const refunds =
    viewMode === "daily"
      ? todayRefunds
      : viewMode === "monthly"
        ? monthRefunds
        : yearRefunds || [];
  const disposed =
    viewMode === "yearly"
      ? yearDisposed || []
      : viewMode === "daily"
        ? (disposedItems || []).filter(
            (d) =>
              format(new Date(d.disposed_at), "yyyy-MM-dd") ===
              format(today, "yyyy-MM-dd"),
          )
        : disposedItems || [];
  const grossRevenue = tx.reduce((s, t) => s + Number(t.total_amount), 0);
  const totalVat = tx.reduce((s, t) => s + Number(t.vat_amount), 0);
  const netRevenue = grossRevenue - totalVat;
  const totalDiscounts = tx
    .filter((t) => t.discount_type)
    .reduce((s, t) => s + Number(t.discount_amount || 0), 0);
  const totalRefundAmt = refunds.reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const refundVat = refunds.reduce((s, t) => s + Number(t.vat_amount), 0);
  const stockLossAmt = disposed.reduce(
    (s, d) => s + Number(d.total_loss || 0),
    0,
  );
  const stockLossUnits = disposed.reduce(
    (s, d) => s + Number(d.quantity || 0),
    0,
  );
  const inventoryValue = (inventoryData || []).reduce(
    (s, p) => s + Number(p.cost_price || p.price || 0) * p.stock_quantity,
    0,
  );
  const inventoryRetailValue = (inventoryData || []).reduce(
    (s, p) => s + Number(p.price || 0) * p.stock_quantity,
    0,
  );
  const cashSales = tx
    .filter((t) => t.payment_method === "cash")
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const cardSales = tx
    .filter((t) => t.payment_method === "card")
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const txCount = tx.length;
  const avgOrder = txCount > 0 ? grossRevenue / txCount : 0;
  const pwdSeniorDiscounts = tx
    .filter((t) => t.discount_type === "senior" || t.discount_type === "pwd")
    .reduce((s, t) => s + Number(t.discount_amount || 0), 0);
  const nearExpiryDiscounts = tx
    .filter((t) => t.discount_type === "near_expiry")
    .reduce((s, t) => s + Number(t.discount_amount || 0), 0);
  const estimatedProfit =
    netRevenue - totalRefundAmt + refundVat - stockLossAmt;
  const cashierSummary = employees
    .map((emp) => {
      const empTx = tx.filter((t) => t.employee_id === emp.user_id);
      return {
        name: emp.name,
        role: emp.role,
        txCount: empTx.length,
        revenue: empTx.reduce(
          (s: number, t: any) => s + Number(t.total_amount),
          0,
        ),
      };
    })
    .filter((e) => e.txCount > 0);
  const periodLabel =
    viewMode === "daily"
      ? format(today, "MMMM d, yyyy")
      : viewMode === "monthly"
        ? format(monthStart, "MMMM yyyy")
        : `Year ${today.getFullYear()}`;
  const fmt = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  const handlePrint = () => {
    if (!summaryRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<html><head><title>Financial Summary — ${periodLabel}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#111}h1{font-size:18px;text-align:center;margin-bottom:2px}h2{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}p.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #ddd;padding:5px 8px;text-align:left;font-size:11px}th{background:#f5f5f5;font-weight:bold}.right{text-align:right}.footer{margin-top:24px;font-size:10px;color:#999;text-align:center}</style></head><body>${summaryRef.current.innerHTML}<div class="footer">Generated by GroceryPOS — ${format(today, "MMMM d, yyyy h:mm a")}</div><script>window.onload=function(){window.print();window.close()}<\/script></body></html>`,
    );
    win.document.close();
  };
  const handleExport = () => {
    exportCSV(
      [
        {
          Category: "REVENUE",
          Item: "Gross Revenue",
          Amount: grossRevenue.toFixed(2),
        },
        {
          Category: "REVENUE",
          Item: "Total VAT (12%)",
          Amount: totalVat.toFixed(2),
        },
        {
          Category: "REVENUE",
          Item: "Net Revenue (ex-VAT)",
          Amount: netRevenue.toFixed(2),
        },
        {
          Category: "REVENUE",
          Item: "Cash Sales",
          Amount: cashSales.toFixed(2),
        },
        {
          Category: "REVENUE",
          Item: "Card Sales",
          Amount: cardSales.toFixed(2),
        },
        {
          Category: "REVENUE",
          Item: "Total Transactions",
          Amount: txCount.toString(),
        },
        {
          Category: "REVENUE",
          Item: "Average Order Value",
          Amount: avgOrder.toFixed(2),
        },
        {
          Category: "DEDUCTIONS",
          Item: "Total Refunds",
          Amount: totalRefundAmt.toFixed(2),
        },
        {
          Category: "DEDUCTIONS",
          Item: "Refund VAT Adjustment",
          Amount: refundVat.toFixed(2),
        },
        {
          Category: "DEDUCTIONS",
          Item: "PWD/Senior Discounts",
          Amount: pwdSeniorDiscounts.toFixed(2),
        },
        {
          Category: "DEDUCTIONS",
          Item: "Near-Expiry Discounts",
          Amount: nearExpiryDiscounts.toFixed(2),
        },
        {
          Category: "DEDUCTIONS",
          Item: "Total Discounts",
          Amount: totalDiscounts.toFixed(2),
        },
        {
          Category: "COSTS",
          Item: "Stock Loss (Disposed)",
          Amount: stockLossAmt.toFixed(2),
        },
        {
          Category: "COSTS",
          Item: "Units Disposed",
          Amount: stockLossUnits.toString(),
        },
        {
          Category: "INVENTORY",
          Item: "Inventory at Cost",
          Amount: inventoryValue.toFixed(2),
        },
        {
          Category: "INVENTORY",
          Item: "Inventory at Retail",
          Amount: inventoryRetailValue.toFixed(2),
        },
        {
          Category: "PROFIT",
          Item: "Estimated Net Profit",
          Amount: estimatedProfit.toFixed(2),
        },
      ],
      `financial-summary-${viewMode}-${periodLabel.replace(/\s/g, "-")}.csv`,
    );
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                View:
              </span>
              <div className="flex rounded-md border overflow-hidden">
                {(["daily", "monthly", "yearly"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${viewMode === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <span className="text-sm text-muted-foreground font-medium">
                — {periodLabel}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <div ref={summaryRef} className="space-y-4">
        <div className="text-center pb-2 border-b">
          <h1 className="text-xl font-bold">GroceryPOS — Financial Summary</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Report —{" "}
            {periodLabel}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Gross Revenue",
              value: fmt(grossRevenue),
              color: "text-success",
              bg: "bg-green-50 dark:bg-green-950/20",
            },
            {
              label: "Net Revenue",
              value: fmt(netRevenue),
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-50 dark:bg-blue-950/20",
              sub: "after VAT",
            },
            {
              label: "Est. Net Profit",
              value: fmt(estimatedProfit),
              color: estimatedProfit >= 0 ? "text-success" : "text-destructive",
              bg:
                estimatedProfit >= 0
                  ? "bg-green-50 dark:bg-green-950/20"
                  : "bg-red-50 dark:bg-red-950/20",
              sub: "after refunds & losses",
            },
            {
              label: "Transactions",
              value: String(txCount),
              color: "",
              bg: "bg-muted/30",
              sub: `avg ${fmt(avgOrder)}/order`,
            },
          ].map((k) => (
            <div key={k.label} className={`p-3 rounded-lg border ${k.bg}`}>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              {(k as any).sub && (
                <p className="text-xs text-muted-foreground">
                  {(k as any).sub}
                </p>
              )}
            </div>
          ))}
        </div>
        {/* Revenue section */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              1. Revenue Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  <TableHead className="text-right text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Gross Revenue
                  </TableCell>
                  <TableCell className="text-right font-bold text-success">
                    {fmt(grossRevenue)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {txCount} transactions
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm pl-6 text-muted-foreground">
                    Cash Sales
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {fmt(cashSales)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {grossRevenue > 0
                      ? ((cashSales / grossRevenue) * 100).toFixed(1)
                      : 0}
                    %
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm pl-6 text-muted-foreground">
                    Card Sales
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {fmt(cardSales)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {grossRevenue > 0
                      ? ((cardSales / grossRevenue) * 100).toFixed(1)
                      : 0}
                    %
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell className="text-sm font-medium">
                    VAT Collected (12%)
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fmt(totalVat)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    remit to BIR
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-bold">
                    Net Revenue (ex-VAT)
                  </TableCell>
                  <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                    {fmt(netRevenue)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    avg {fmt(avgOrder)}/order
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Deductions */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              2. Deductions & Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  <TableHead className="text-right text-xs">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium text-destructive">
                    Total Refunds
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    — {fmt(totalRefundAmt)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {refunds.length} transactions
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm pl-6 text-muted-foreground">
                    VAT on Refunds (adj.)
                  </TableCell>
                  <TableCell className="text-right text-sm text-success">
                    + {fmt(refundVat)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    VAT returned
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    PWD / Senior Discounts
                  </TableCell>
                  <TableCell className="text-right font-medium text-warning">
                    — {fmt(pwdSeniorDiscounts)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {
                      tx.filter(
                        (t) =>
                          t.discount_type === "senior" ||
                          t.discount_type === "pwd",
                      ).length
                    }{" "}
                    tx
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Near-Expiry Discounts
                  </TableCell>
                  <TableCell className="text-right font-medium text-warning">
                    — {fmt(nearExpiryDiscounts)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    waste recovery
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell className="text-sm font-bold">
                    Total Deductions
                  </TableCell>
                  <TableCell className="text-right font-bold text-destructive">
                    — {fmt(totalRefundAmt - refundVat + totalDiscounts)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Stock Loss */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              3. Stock Loss
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  <TableHead className="text-right text-xs">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Stock Loss (Disposed / Expired)
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    — {fmt(stockLossAmt)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {stockLossUnits} units disposed
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Inventory */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              4. Inventory Snapshot (Current)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                  <TableHead className="text-right text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Inventory at Cost
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fmt(inventoryValue)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    capital tied in stock
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Inventory at Retail Value
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fmt(inventoryRetailValue)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    if all sold at full price
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Potential Gross Margin
                  </TableCell>
                  <TableCell className="text-right font-medium text-success">
                    {fmt(inventoryRetailValue - inventoryValue)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    retail − cost
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Cashier */}
        {cashierSummary.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                5. Employee Sales Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Employee</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-right text-xs">
                      Transactions
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Revenue
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Avg Order
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashierSummary.map((e) => (
                    <TableRow key={e.name}>
                      <TableCell className="text-sm font-medium">
                        {e.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {e.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {e.txCount}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {fmt(e.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {fmt(e.txCount > 0 ? e.revenue / e.txCount : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        {/* Bottom Line */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              6. Bottom Line
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">Gross Revenue</TableCell>
                  <TableCell className="text-right font-medium">
                    {fmt(grossRevenue)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    − VAT (12%)
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    − {fmt(totalVat)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    − Refunds
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    − {fmt(totalRefundAmt)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    − Stock Loss
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    − {fmt(stockLossAmt)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    + Refund VAT Adj.
                  </TableCell>
                  <TableCell className="text-right text-sm text-success">
                    + {fmt(refundVat)}
                  </TableCell>
                </TableRow>
                <TableRow className="border-t-2 border-primary/20 bg-muted/30">
                  <TableCell className="text-base font-bold">
                    Estimated Net Profit
                  </TableCell>
                  <TableCell
                    className={`text-right text-lg font-bold ${estimatedProfit >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {fmt(estimatedProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground px-4 pb-3 pt-2">
              * Excludes rent, utilities, and other overhead not tracked in this
              system.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

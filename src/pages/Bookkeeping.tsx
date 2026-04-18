/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react";
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
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  FileText,
  Download,
  RotateCcw,
  Eye,
  Printer,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
} from "date-fns";

export default function Bookkeeping() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(today, "yyyy-MM"));
  const [dailyDetailDate, setDailyDetailDate] = useState<string | null>(null);
  const dailyReportRef = useRef<HTMLDivElement>(null);

  const monthStart = startOfMonth(new Date(selectedMonth + "-01"));
  const monthEnd = endOfMonth(monthStart);
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();

  // Disposed items
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

  // Today's transactions (completed)
  const { data: todayTx } = useQuery({
    queryKey: ["bk-today-tx"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, employees(name)")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Monthly transactions (completed)
  const { data: monthTx } = useQuery({
    queryKey: ["bk-month-tx", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, employees(name)")
        .gte("created_at", startOfDay(monthStart).toISOString())
        .lte("created_at", endOfDay(monthEnd).toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Monthly refunds
  const { data: monthRefunds } = useQuery({
    queryKey: ["bk-month-refunds", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*, employees(name)")
        .gte("created_at", startOfDay(monthStart).toISOString())
        .lte("created_at", endOfDay(monthEnd).toISOString())
        .eq("status", "refunded")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Today's refunds
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

  // Top selling products this month
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

  // Low stock products
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

  // Slow-moving stock
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

  // Employees for cashier performance
  const { data: employees } = useQuery({
    queryKey: ["bk-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, role")
        .eq("is_active", true);
      return data || [];
    },
  });

  // Daily summary calcs
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

  // Discount calcs
  const todayDiscounts = (todayTx || []).filter((t) => t.discount_type);
  const todayDiscountTotal = todayDiscounts.reduce(
    (s, t) => s + Number(t.discount_amount),
    0,
  );
  // const todayWasteLoss = (disposedItems || []).reduce(
  //   (s, d) => s + Number(d.total_loss),
  //   0,
  // );

  // Monthly calcs
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

  // Cashier performance
  const cashierPerf =
    employees
      ?.map((emp) => {
        const empTx = (monthTx || []).filter((t) => t.employee_id === emp.id);
        return {
          name: emp.name,
          role: emp.role,
          txCount: empTx.length,
          revenue: empTx.reduce((s, t) => s + Number(t.total_amount), 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue) || [];

  // Aggregate daily breakdown for the month
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
      const existing = map.get(day) || {
        date: day,
        revenue: 0,
        vat: 0,
        txCount: 0,
        refunds: 0,
      };
      existing.revenue += Number(tx.total_amount);
      existing.vat += Number(tx.vat_amount);
      existing.txCount += 1;
      map.set(day, existing);
    });
    (monthRefunds || []).forEach((tx) => {
      const day = format(new Date(tx.created_at), "yyyy-MM-dd");
      const existing = map.get(day) || {
        date: day,
        revenue: 0,
        vat: 0,
        txCount: 0,
        refunds: 0,
      };
      existing.refunds += Number(tx.total_amount);
      map.set(day, existing);
    });
    return Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  })();

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      {/* Today's Summary (Z-Report style) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Today's Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              ₱{todayRevenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {todayTx?.length || 0} transactions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cash Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₱{todayCash.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Card Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₱{todayCard.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's VAT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₱{todayVat.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              Net: ₱{todayNet.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Today's Refunds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              ₱{todayRefundTotal.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {todayRefunds?.length || 0} refunded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Discounts Given
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">
              ₱{todayDiscountTotal.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {todayDiscounts.length} discounted
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="tabs-scroll flex w-full overflow-x-auto scrollbar-none h-auto p-1 justify-start">
          <TabsTrigger value="summary" className="shrink-0">
            <FileText className="h-4 w-4 mr-1" /> Financial Summary
          </TabsTrigger>
          <TabsTrigger value="daily" className="shrink-0">
            <Receipt className="h-4 w-4 mr-1" /> Daily Sales
          </TabsTrigger>
          <TabsTrigger value="monthly" className="shrink-0">
            <TrendingUp className="h-4 w-4 mr-1" /> Monthly Revenue
          </TabsTrigger>
          <TabsTrigger value="top" className="shrink-0">
            <Package className="h-4 w-4 mr-1" /> Top Products
          </TabsTrigger>
          <TabsTrigger value="lowstock" className="shrink-0">
            <Package className="h-4 w-4 mr-1" /> Low Stock
          </TabsTrigger>
          <TabsTrigger value="slow" className="shrink-0">
            <TrendingDown className="h-4 w-4 mr-1" /> Slow Moving
          </TabsTrigger>
          <TabsTrigger value="cashier" className="shrink-0">
            <Users className="h-4 w-4 mr-1" /> Cashier Performance
          </TabsTrigger>
          <TabsTrigger value="vat" className="shrink-0">
            <FileText className="h-4 w-4 mr-1" /> VAT Report
          </TabsTrigger>
          <TabsTrigger value="refunds" className="shrink-0">
            <RotateCcw className="h-4 w-4 mr-1" /> Refunds
          </TabsTrigger>
          <TabsTrigger value="discounts" className="shrink-0">
            Discounts & Waste
          </TabsTrigger>
        </TabsList>

        {/* Financial Summary */}
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
        {/* Daily Sales Record */}
        <TabsContent value="daily">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Daily Sales Record</CardTitle>
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
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyBreakdown.map((d) => (
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
                  {dailyBreakdown.length === 0 && (
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Revenue Summary */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Monthly Revenue — {format(monthStart, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Gross Revenue</p>
                  <p className="text-2xl font-bold text-success">
                    ₱{monthRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total VAT</p>
                  <p className="text-2xl font-bold">₱{monthVat.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Net Revenue</p>
                  <p className="text-2xl font-bold">₱{monthNet.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Refunds</p>
                  <p className="text-2xl font-bold text-destructive">
                    ₱{monthRefundTotal.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold">{monthTx?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Products */}
        <TabsContent value="top">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Selling Products</CardTitle>
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
                      <TableCell>{i + 1}</TableCell>
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

        {/* Low Stock */}
        <TabsContent value="lowstock">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Low Stock Report</CardTitle>
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
                  {lowStock?.map((p) => (
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
                  {(!lowStock || lowStock.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        All stocked up!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slow-Moving Stock */}
        <TabsContent value="slow">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowMoving?.map((p) => (
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
                    </TableRow>
                  ))}
                  {(!slowMoving || slowMoving.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        All products are moving well
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cashier Performance */}
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

        {/* VAT Report */}
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
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total Gross Sales
                  </p>
                  <p className="text-xl font-bold">
                    ₱{monthRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total VAT (12%)
                  </p>
                  <p className="text-xl font-bold">₱{monthVat.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total Net Sales
                  </p>
                  <p className="text-xl font-bold">₱{monthNet.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Refund VAT Adj.
                  </p>
                  <p className="text-xl font-bold text-destructive">
                    ₱{monthRefundVat.toFixed(2)}
                  </p>
                </div>
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
                  {dailyBreakdown.map((d) => (
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
                  {dailyBreakdown.length === 0 && (
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

        {/* Refunds */}
        <TabsContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Refunds —{" "}
                {format(monthStart, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Total Refunded
                  </p>
                  <p className="text-xl font-bold text-destructive">
                    ₱{monthRefundTotal.toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Refund Count</p>
                  <p className="text-xl font-bold">
                    {monthRefunds?.length || 0}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    VAT on Refunds
                  </p>
                  <p className="text-xl font-bold">
                    ₱{monthRefundVat.toFixed(2)}
                  </p>
                </div>
              </div>
              {monthRefunds && monthRefunds.length > 0 ? (
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
                    {monthRefunds.map((tx) => (
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
                          {(tx.employees as any)?.name || "—"}
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
                <p className="text-sm text-muted-foreground text-center py-4">
                  No refunds this month
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discounts & Waste */}
        <TabsContent value="discounts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Discounts & Expiry Waste — {format(monthStart, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    PWD/Senior Discounts
                  </p>
                  <p className="text-2xl font-bold text-warning">
                    ₱{monthDiscountTotal.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(monthTx || []).filter((t) => t.discount_type).length}{" "}
                    transactions
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Expiry Waste Loss
                  </p>
                  <p className="text-2xl font-bold text-destructive">
                    ₱{monthWasteLoss.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(disposedItems || []).reduce((s, d) => s + d.quantity, 0)}{" "}
                    units disposed
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Discounted Revenue
                  </p>
                  <p className="text-2xl font-bold text-success">
                    ₱
                    {(monthTx || [])
                      .filter((t) => t.discount_type)
                      .reduce((s, t) => s + Number(t.total_amount), 0)
                      .toFixed(2)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Net Adj. Revenue
                  </p>
                  <p className="text-2xl font-bold">
                    ₱
                    {(monthRevenue - monthRefundTotal - monthWasteLoss).toFixed(
                      2,
                    )}
                  </p>
                </div>
              </div>

              {disposedItems && disposedItems.length > 0 && (
                <>
                  <h4 className="text-sm font-medium mb-2">Disposed Items</h4>
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
                      {disposedItems.map((d) => (
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Daily Detail Dialog */}
      <DailyDetailDialog
        date={dailyDetailDate}
        onClose={() => setDailyDetailDate(null)}
        reportRef={dailyReportRef}
        exportCSV={exportCSV}
      />
    </div>
  );
}

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
        .select("*, employees(name)")
        .gte("created_at", startOfDay(new Date(date!)).toISOString())
        .lte("created_at", endOfDay(new Date(date!)).toISOString())
        .order("created_at", { ascending: true });
      return data || [];
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
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Daily Sales Report - ${format(new Date(date), "MMM d, yyyy")}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;max-width:800px;margin:0 auto}
      table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:bold}.right{text-align:right}.bold{font-weight:bold}
      h2{text-align:center;margin-bottom:4px}p.sub{text-align:center;color:#666;margin-top:0}
      .summary{display:flex;gap:20px;margin:10px 0}.summary div{flex:1;padding:8px;background:#f9f9f9;border-radius:4px}</style>
      </head><body>${reportRef.current.innerHTML}
      <script>window.onload=function(){window.print();window.close()}<\/script></body></html>
    `);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const rows = (dayTx || []).map((tx) => {
      const items = (dayItems || []).filter((i) => i.transaction_id === tx.id);
      return {
        "Transaction ID": tx.id.slice(0, 8),
        Time: format(new Date(tx.created_at), "h:mm a"),
        Cashier: (tx.employees as any)?.name || "—",
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

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            <div className="p-2 md:p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-base md:text-lg font-bold text-success">
                ₱{totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="p-2 md:p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Cash / Card</p>
              <p className="text-xs md:text-sm font-medium">
                ₱{cashTotal.toFixed(2)} / ₱{cardTotal.toFixed(2)}
              </p>
            </div>
            <div className="p-2 md:p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">VAT Collected</p>
              <p className="text-base md:text-lg font-bold">
                ₱{totalVat.toFixed(2)}
              </p>
            </div>
            <div className="p-2 md:p-3 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Refunds</p>
              <p className="text-base md:text-lg font-bold text-destructive">
                ₱{totalRefunds.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {refunded.length} transactions
              </p>
            </div>
          </div>

          {/* Transactions Table — horizontal scroll on mobile */}
          <div className="rounded-md border overflow-hidden">
            <div className="max-h-[250px] md:max-h-[350px] overflow-y-auto overflow-x-auto">
              <Table className="min-w-[640px]">
                {" "}
                {/* forces table to not squish */}
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Cashier</TableHead>
                    <TableHead className="text-xs">Items</TableHead>
                    <TableHead className="text-xs">Payment</TableHead>
                    <TableHead className="text-right text-xs">VAT</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
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
                          {(tx.employees as any)?.name || "—"}
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
                            className={`text-xs whitespace-nowrap ${
                              tx.status === "completed"
                                ? "bg-success text-success-foreground"
                                : tx.status === "refunded"
                                  ? "bg-warning text-warning-foreground"
                                  : "bg-destructive text-destructive-foreground"
                            }`}
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

          {/* Totals footer */}
          <div className="border-t mt-4 pt-3 space-y-1 text-xs md:text-sm">
            <div className="flex justify-between">
              <span>Total Transactions</span>
              <span className="font-bold">
                {completed.length} completed, {refunded.length} refunded
              </span>
            </div>
            <div className="flex justify-between">
              <span>Gross Revenue</span>
              <span className="font-bold">₱{totalRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total VAT (12%)</span>
              <span>₱{totalVat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Net Revenue</span>
              <span>₱{(totalRevenue - totalVat).toFixed(2)}</span>
            </div>
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

function FinancialSummaryTab({
  selectedMonth,
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

  // --- Yearly data ---
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

  // --- Payroll (shifts) ---
  const { data: monthShifts } = useQuery({
    queryKey: ["fs-shifts", selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*, employees(name, hourly_rate)")
        .gte("clock_in", startOfMonth(monthStart).toISOString())
        .lte("clock_in", endOfMonth(monthStart).toISOString())
        .not("clock_out", "is", null);
      return data || [];
    },
  });

  const { data: yearShifts } = useQuery({
    queryKey: ["fs-year-shifts", today.getFullYear()],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*, employees(name, hourly_rate)")
        .gte("clock_in", `${today.getFullYear()}-01-01`)
        .lte("clock_in", `${today.getFullYear()}-12-31`)
        .not("clock_out", "is", null);
      return data || [];
    },
  });

  // --- Inventory value ---
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

  // Helper: compute payroll from shifts
  const computePayroll = (shifts: any[]) =>
    (shifts || []).reduce((sum, s) => {
      if (!s.clock_out) return sum;
      const hours =
        (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) /
        3600000;
      const rate = Number((s.employees as any)?.hourly_rate || 0);
      return sum + hours * rate;
    }, 0);

  // Helper: pick the right dataset based on viewMode
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
  const disposed = viewMode === "yearly" ? yearDisposed || [] : disposedItems;
  const shifts = viewMode === "yearly" ? yearShifts || [] : monthShifts || [];

  // --- Compute all figures ---
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

  const payrollCost = computePayroll(shifts);

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

  // Estimated net profit (gross - vat - refunds - payroll - stock loss)
  const estimatedProfit =
    netRevenue - totalRefundAmt + refundVat - payrollCost - stockLossAmt;

  // Per-cashier summary
  const cashierSummary = employees
    .map((emp) => {
      const empTx = tx.filter((t) => t.employee_id === emp.id);
      const empShifts = shifts.filter((s: any) => s.employee_id === emp.id);
      const hours = empShifts.reduce((sum: number, s: any) => {
        if (!s.clock_out) return sum;
        return (
          sum +
          (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) /
            3600000
        );
      }, 0);
      const pay = hours * Number(emp.hourly_rate || 0);
      return {
        name: emp.name,
        role: emp.role,
        txCount: empTx.length,
        revenue: empTx.reduce(
          (s: number, t: any) => s + Number(t.total_amount),
          0,
        ),
        hours: hours.toFixed(1),
        pay,
      };
    })
    .filter((e) => e.txCount > 0 || Number(e.hours) > 0);

  // Period label
  const periodLabel =
    viewMode === "daily"
      ? format(today, "MMMM d, yyyy")
      : viewMode === "monthly"
        ? format(monthStart, "MMMM yyyy")
        : `Year ${today.getFullYear()}`;

  const handlePrint = () => {
    if (!summaryRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
      <head>
        <title>Financial Summary — ${periodLabel}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 2px; }
          h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          h3 { font-size: 12px; margin: 12px 0 4px; color: #555; }
          p.sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; font-size: 11px; }
          th { background: #f5f5f5; font-weight: bold; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .box { border: 1px solid #ddd; padding: 8px 12px; border-radius: 4px; }
          .box .label { font-size: 10px; color: #666; }
          .box .value { font-size: 16px; font-weight: bold; }
          .highlight { background: #f0fdf4; }
          .danger { color: #dc2626; }
          .success { color: #16a34a; }
          .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; }
        </style>
      </head>
      <body>${summaryRef.current.innerHTML}
      <div class="footer">Generated by GroceryPOS — ${format(today, "MMMM d, yyyy h:mm a")}</div>
      <script>window.onload=function(){window.print();window.close()}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const handleExport = () => {
    const rows = [
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
      { Category: "REVENUE", Item: "Cash Sales", Amount: cashSales.toFixed(2) },
      { Category: "REVENUE", Item: "Card Sales", Amount: cardSales.toFixed(2) },
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
        Item: "Total Discounts Given",
        Amount: totalDiscounts.toFixed(2),
      },
      {
        Category: "COSTS",
        Item: "Payroll Cost",
        Amount: payrollCost.toFixed(2),
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
        Item: "Current Inventory (Cost)",
        Amount: inventoryValue.toFixed(2),
      },
      {
        Category: "INVENTORY",
        Item: "Current Inventory (Retail)",
        Amount: inventoryRetailValue.toFixed(2),
      },
      {
        Category: "PROFIT",
        Item: "Estimated Net Profit",
        Amount: estimatedProfit.toFixed(2),
      },
    ];
    exportCSV(
      rows,
      `financial-summary-${viewMode}-${periodLabel.replace(/\s/g, "-")}.csv`,
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
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
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      viewMode === v
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
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

      {/* The printable summary */}
      <div ref={summaryRef} className="space-y-4">
        <div className="text-center pb-2 border-b">
          <h1 className="text-xl font-bold">GroceryPOS — Financial Summary</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Report —{" "}
            {periodLabel}
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
            <p className="text-xs text-muted-foreground">Gross Revenue</p>
            <p className="text-xl font-bold text-success">
              ₱
              {grossRevenue.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
            <p className="text-xs text-muted-foreground">Net Revenue</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              ₱
              {netRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">after VAT</p>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              estimatedProfit >= 0
                ? "bg-green-50 dark:bg-green-950/20"
                : "bg-red-50 dark:bg-red-950/20"
            }`}
          >
            <p className="text-xs text-muted-foreground">Est. Net Profit</p>
            <p
              className={`text-xl font-bold ${
                estimatedProfit >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              ₱
              {estimatedProfit.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              after refunds, payroll, losses
            </p>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-bold">{txCount}</p>
            <p className="text-xs text-muted-foreground">
              avg ₱{avgOrder.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Section 1: Revenue Breakdown */}
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
                    ₱
                    {grossRevenue.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
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
                    ₱
                    {cashSales.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
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
                    ₱
                    {cardSales.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
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
                    ₱
                    {totalVat.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    remit to BIR
                  </TableCell>
                </TableRow>
                <TableRow className="font-semibold">
                  <TableCell className="text-sm font-bold">
                    Net Revenue (ex-VAT)
                  </TableCell>
                  <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                    ₱
                    {netRevenue.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    avg ₱{avgOrder.toFixed(2)}/order
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Section 2: Deductions */}
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
                    — ₱
                    {totalRefundAmt.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
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
                    + ₱
                    {refundVat.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
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
                    — ₱
                    {pwdSeniorDiscounts.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {
                      tx.filter(
                        (t) =>
                          t.discount_type === "senior" ||
                          t.discount_type === "pwd",
                      ).length
                    }{" "}
                    transactions
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Near-Expiry Discounts
                  </TableCell>
                  <TableCell className="text-right font-medium text-warning">
                    — ₱
                    {nearExpiryDiscounts.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    waste recovery
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/20 font-semibold">
                  <TableCell className="text-sm font-bold">
                    Total Deductions
                  </TableCell>
                  <TableCell className="text-right font-bold text-destructive">
                    — ₱
                    {(
                      totalRefundAmt -
                      refundVat +
                      totalDiscounts
                    ).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Section 3: Costs */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              3. Operating Costs
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
                    Payroll Cost
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    — ₱
                    {payrollCost.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    based on shifts + hourly rate
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">
                    Stock Loss (Disposed / Expired)
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    — ₱
                    {stockLossAmt.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {stockLossUnits} units disposed
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell className="text-sm font-bold">
                    Total Operating Costs
                  </TableCell>
                  <TableCell className="text-right font-bold text-destructive">
                    — ₱
                    {(payrollCost + stockLossAmt).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Section 4: Inventory Snapshot */}
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
                    ₱
                    {inventoryValue.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
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
                    ₱
                    {inventoryRetailValue.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
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
                    ₱
                    {(inventoryRetailValue - inventoryValue).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits: 2,
                      },
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    retail − cost
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Section 5: Cashier / Payroll Breakdown */}
        {cashierSummary.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                5. Employee Summary
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
                    <TableHead className="text-right text-xs">Hours</TableHead>
                    <TableHead className="text-right text-xs">Pay</TableHead>
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
                        ₱
                        {e.revenue.toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {e.hours}h
                      </TableCell>
                      <TableCell className="text-right text-sm text-destructive">
                        ₱
                        {e.pay.toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Section 6: Bottom Line */}
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
                    ₱
                    {grossRevenue.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    − VAT (12%)
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    − ₱
                    {totalVat.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    − Refunds
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    − ₱
                    {totalRefundAmt.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    − Payroll
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    − ₱
                    {payrollCost.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    − Stock Loss
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    − ₱
                    {stockLossAmt.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground pl-6">
                    + Refund VAT Adj.
                  </TableCell>
                  <TableCell className="text-right text-sm text-success">
                    + ₱
                    {refundVat.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
                <TableRow className="border-t-2 border-primary/20 bg-muted/30">
                  <TableCell className="text-base font-bold">
                    Estimated Net Profit
                  </TableCell>
                  <TableCell
                    className={`text-right text-lg font-bold ${
                      estimatedProfit >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    ₱
                    {estimatedProfit.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground px-4 pb-3 pt-2">
              * Estimated profit excludes rent, utilities, and other overhead
              not tracked in this system.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

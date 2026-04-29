/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Banknote,
  ReceiptText,
  ShieldAlert,
  Layers,
  CalendarDays,
  Clock,
  User,
  StickyNote,
  CheckCircle2,
} from "lucide-react";
import { useRef } from "react";

// ── helpers ────────────────────────────────────────────────────────────────────
const ph = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// Type guards
type DailyLog = {
  id: string;
  log_date: string;
  total_sales: number;
  transaction_count: number;
  vat_amount: number;
  discount_amount: number;
  refund_amount: number;
  refund_count: number;
  cash_sales: number;
  card_sales: number;
  stock_loss: number;
  net_profit: number;
  closed_by?: string | null;
  notes?: string | null;
  created_at: string;
};

type MonthlyLog = {
  id: string;
  log_year: number;
  log_month: number;
  total_sales: number;
  transaction_count: number;
  vat_amount: number;
  discount_amount: number;
  refund_amount: number;
  refund_count: number;
  cash_sales: number;
  card_sales: number;
  stock_loss: number;
  net_profit: number;
  closed_by?: string | null;
  notes?: string | null;
  created_at: string;
};

type LogRecord = DailyLog | MonthlyLog;

function isDailyLog(log: LogRecord): log is DailyLog {
  return "log_date" in log;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: "green" | "red" | "blue" | "amber" | "default";
}) {
  const colors = {
    green:
      "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400",
    red: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400",
    blue: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400",
    amber:
      "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400",
    default: "bg-muted/30 border-border text-foreground",
  };
  const ring = colors[accent ?? "default"];
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1.5 ${ring}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2.5 border-b last:border-0 ${bold ? "font-semibold" : ""}`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm ${bold ? "font-bold text-base" : ""} ${color || ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LogDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") as "daily" | "monthly" | null;
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch the log record
  const { data: log, isLoading } = useQuery<LogRecord>({
    queryKey: ["log-detail", id, type],
    enabled: !!id && !!type,
    queryFn: async () => {
      if (type === "daily") {
        const { data } = await supabase
          .from("daily_logs")
          .select("*")
          .eq("id", id!)
          .single();
        return data as DailyLog;
      } else {
        const { data } = await supabase
          .from("monthly_logs")
          .select("*")
          .eq("id", id!)
          .single();
        return data as MonthlyLog;
      }
    },
  });

  // Fetch who closed it
  const { data: closedByName } = useQuery({
    queryKey: ["log-closer", log?.closed_by],
    enabled: !!log?.closed_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("name")
        .eq("user_id", log!.closed_by!)
        .maybeSingle();
      return data?.name || null;
    },
  });

  // Fetch shift logs for this period
  const { data: shiftLogs } = useQuery({
    queryKey: ["log-shifts", id, type, log],
    enabled: !!log,
    queryFn: async () => {
      let start: string, end: string;
      if (type === "daily") {
        if (isDailyLog(log!)) {
          start = startOfDay(new Date(log.log_date)).toISOString();
          end = endOfDay(new Date(log.log_date)).toISOString();
        } else {
          // Fallback — should not happen but satisfies TypeScript
          const d = new Date(log!.log_year, log!.log_month - 1, 1);
          start = startOfDay(d).toISOString();
          end = endOfDay(d).toISOString();
        }
      } else {
        if (!isDailyLog(log!)) {
          const d = new Date(log!.log_year, log!.log_month - 1, 1);
          start = startOfDay(
            new Date(d.getFullYear(), d.getMonth(), 1),
          ).toISOString();
          end = endOfDay(
            new Date(d.getFullYear(), d.getMonth() + 1, 0),
          ).toISOString();
        } else {
          // Fallback — should not happen
          start = startOfDay(new Date(log!.log_date)).toISOString();
          end = endOfDay(new Date(log!.log_date)).toISOString();
        }
      }
      const { data } = await supabase
        .from("shifts")
        .select("*, employees(name, role)")
        .gte("clock_in", start)
        .lte("clock_in", end)
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: true });
      return data || [];
    },
  });

  const exportCSV = () => {
    if (!log) return;
    const isDaily = isDailyLog(log);
    const rows = [
      { Field: "Type", Value: isDaily ? "Daily Log" : "Monthly Log" },
      {
        Field: "Period",
        Value: isDaily
          ? format(new Date(log.log_date), "MMMM d, yyyy")
          : format(new Date(log.log_year, log.log_month - 1, 1), "MMMM yyyy"),
      },
      { Field: "Total Sales", Value: Number(log.total_sales).toFixed(2) },
      { Field: "Transactions", Value: log.transaction_count },
      { Field: "Cash Sales", Value: Number(log.cash_sales).toFixed(2) },
      { Field: "Card Sales", Value: Number(log.card_sales).toFixed(2) },
      { Field: "VAT Amount", Value: Number(log.vat_amount).toFixed(2) },
      {
        Field: "Discount Amount",
        Value: Number(log.discount_amount).toFixed(2),
      },
      { Field: "Refund Amount", Value: Number(log.refund_amount).toFixed(2) },
      { Field: "Refund Count", Value: log.refund_count },
      { Field: "Stock Loss", Value: Number(log.stock_loss).toFixed(2) },
      { Field: "Net Profit", Value: Number(log.net_profit).toFixed(2) },
      { Field: "Closed By", Value: closedByName || "—" },
      {
        Field: "Closed At",
        Value: format(new Date(log.created_at), "MMM d, yyyy h:mm a"),
      },
      { Field: "Notes", Value: log.notes || "" },
    ];
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(","),
      ...rows.map((r: any) => keys.map((k) => `"${r[k]}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Log Summary</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#111;max-width:800px;margin:0 auto}
      h1{font-size:20px;text-align:center;margin-bottom:4px}
      h2{font-size:13px;font-weight:600;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #ddd;text-transform:uppercase;letter-spacing:.04em;color:#555}
      .sub{text-align:center;color:#666;font-size:11px;margin-bottom:20px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
      .card{border:1px solid #ddd;border-radius:6px;padding:10px}
      .card-label{font-size:10px;color:#888;margin-bottom:3px}
      .card-val{font-size:16px;font-weight:700}
      table{width:100%;border-collapse:collapse;margin-bottom:14px}
      th,td{padding:6px 8px;text-align:left;font-size:11px;border-bottom:1px solid #eee}
      th{font-weight:600;color:#555;background:#f9f9f9}
      .right{text-align:right}
      .green{color:#16a34a}.red{color:#dc2626}.muted{color:#888}
      .footer{margin-top:24px;font-size:10px;color:#aaa;text-align:center}
    </style>
    </head><body>${printRef.current.innerHTML}
    <script>window.onload=function(){window.print();window.close()}<\/script></body></html>`);
    w.document.close();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading log…</p>
        </div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Log record not found.</p>
        <Button variant="outline" onClick={() => navigate("/bookkeeping")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Bookkeeping
        </Button>
      </div>
    );
  }

  const isDaily = isDailyLog(log);
  const periodLabel = isDaily
    ? format(new Date(log.log_date), "MMMM d, yyyy")
    : format(new Date(log.log_year, log.log_month - 1, 1), "MMMM yyyy");

  const revenue = Number(log.total_sales);
  const vat = Number(log.vat_amount);
  const cash = Number(log.cash_sales);
  const card = Number(log.card_sales);
  const refunds = Number(log.refund_amount);
  const discounts = Number(log.discount_amount);
  const stockLoss = Number(log.stock_loss);
  const netProfit = Number(log.net_profit);
  const netRevenue = revenue - vat;
  const cashPct = revenue > 0 ? ((cash / revenue) * 100).toFixed(0) : "0";
  const cardPct = revenue > 0 ? ((card / revenue) * 100).toFixed(0) : "0";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/bookkeeping?tab=logs")}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Printable area */}
      <div ref={printRef} className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-1 pb-4 border-b">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isDaily ? (
              <CalendarDays className="h-5 w-5 text-primary" />
            ) : (
              <Layers className="h-5 w-5 text-primary" />
            )}
            <Badge variant="secondary" className="text-xs font-medium">
              {isDaily ? "Daily Log" : "Monthly Log"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">GroceryPOS</h1>
          <p className="text-muted-foreground font-medium">{periodLabel}</p>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Closed{" "}
              {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
            {closedByName && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                by {closedByName}
              </span>
            )}
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard
            label="Gross Revenue"
            value={ph(revenue)}
            sub={`${log.transaction_count} transactions`}
            icon={DollarSign}
            accent="green"
          />
          <StatCard
            label="Net Revenue"
            value={ph(netRevenue)}
            sub="after VAT"
            icon={TrendingUp}
            accent="blue"
          />
          <StatCard
            label="Est. Net Profit"
            value={ph(netProfit)}
            sub="after refunds & losses"
            icon={netProfit >= 0 ? TrendingUp : TrendingDown}
            accent={netProfit >= 0 ? "green" : "red"}
          />
          <StatCard
            label="Cash Sales"
            value={ph(cash)}
            sub={`${cashPct}% of revenue`}
            icon={Banknote}
            accent="default"
          />
          <StatCard
            label="Card Sales"
            value={ph(card)}
            sub={`${cardPct}% of revenue`}
            icon={CreditCard}
            accent="default"
          />
          <StatCard
            label="VAT Collected"
            value={ph(vat)}
            sub="remit to BIR"
            icon={ReceiptText}
            accent="default"
          />
        </div>

        {/* Revenue breakdown */}
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Revenue Breakdown</h2>
          </div>
          <div className="px-4 divide-y">
            <Row label="Gross Revenue" value={ph(revenue)} bold />
            <Row label="Cash Sales" value={ph(cash)} />
            <Row label="Card Sales" value={ph(card)} />
            <Row
              label="VAT Collected (12%)"
              value={`− ${ph(vat)}`}
              color="text-muted-foreground"
            />
            <Row
              label="Net Revenue (ex-VAT)"
              value={ph(netRevenue)}
              bold
              color="text-blue-600 dark:text-blue-400"
            />
          </div>
        </div>

        {/* Deductions */}
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Deductions & Losses</h2>
          </div>
          <div className="px-4 divide-y">
            <Row
              label="Refunds"
              value={`− ${ph(refunds)}`}
              color={refunds > 0 ? "text-destructive" : "text-muted-foreground"}
            />
            <Row
              label="PWD / Senior Discounts"
              value={`− ${ph(discounts)}`}
              color={discounts > 0 ? "text-amber-600" : "text-muted-foreground"}
            />
            <Row
              label="Stock Loss (Disposed)"
              value={`− ${ph(stockLoss)}`}
              color={
                stockLoss > 0 ? "text-destructive" : "text-muted-foreground"
              }
            />
          </div>
        </div>

        {/* Bottom line */}
        <div
          className={`rounded-xl border-2 overflow-hidden ${netProfit >= 0 ? "border-emerald-300 dark:border-emerald-700" : "border-destructive/30"}`}
        >
          <div
            className={`px-4 py-3 border-b flex items-center gap-2 ${netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}`}
          >
            {netProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <h2 className="text-sm font-semibold text-muted-foreground">
              Bottom Line
            </h2>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Estimated Net Profit
            </span>
            <span
              className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
            >
              {ph(netProfit)}
            </span>
          </div>
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            = Revenue − VAT − Refunds − Stock Loss
          </p>
        </div>

        {/* Shift breakdown for this period */}
        {shiftLogs && shiftLogs.length > 0 && (
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                Shift Records{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({shiftLogs.length} shift{shiftLogs.length !== 1 ? "s" : ""})
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Cashier
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Clock In
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Clock Out
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Duration
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Start Cash
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">
                      End Cash
                    </th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Diff
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shiftLogs.map((shift: any) => {
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
                    return (
                      <tr
                        key={shift.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium">
                          {emp?.name || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(shift.clock_in), "h:mm a")}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {shift.clock_out
                            ? format(new Date(shift.clock_out), "h:mm a")
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          {hrs > 0 ? `${hrs}h ` : ""}
                          {mins}m
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          {shift.starting_cash != null
                            ? ph(Number(shift.starting_cash))
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          {shift.ending_cash != null
                            ? ph(Number(shift.ending_cash))
                            : "—"}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right text-xs font-medium ${isBalanced ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-destructive"}`}
                        >
                          {shift.cash_difference != null
                            ? (diff >= 0 ? "+" : "") + ph(diff)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {shift.ending_cash != null ? (
                            isBalanced ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        {log.notes && (
          <div className="rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Notes</h2>
            </div>
            <p className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">
              {log.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground pt-2">
          GroceryPOS · {isDaily ? "Daily" : "Monthly"} Log · {periodLabel} ·
          Generated {format(new Date(), "MMM d, yyyy h:mm a")}
        </p>
      </div>
    </div>
  );
}

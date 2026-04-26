/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  LogOut,
  History,
  BookOpen,
  Timer,
  TimerOff,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ── Types ──────────────────────────────────────────────────────────────────────
type DayStatus = "closed" | "open" | null;

type CashboxForm = {
  type: "cash_in" | "cash_out";
  amount: string;
  reason: string;
};

// ── Countdown Button ──────────────────────────────────────────────────────────
// Shows a 10-second countdown before enabling the confirm button — prevents accidental misclicks.
function CountdownConfirmButton({
  label,
  pendingLabel,
  onConfirm,
  isPending,
  variant = "default",
  seconds = 10,
}: {
  label: string;
  pendingLabel: string;
  onConfirm: () => void;
  isPending: boolean;
  variant?: "default" | "destructive" | "success";
  seconds?: number;
}) {
  const [countdown, setCountdown] = useState(seconds);
  const [ready, setReady] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start countdown as soon as this component mounts (popover opened)
  useEffect(() => {
    setCountdown(seconds);
    setReady(false);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [seconds]);

  const bgClass =
    variant === "destructive"
      ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
      : variant === "success"
        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
        : "bg-primary hover:bg-primary/90 text-primary-foreground";

  return (
    <div className="space-y-2">
      {!ready && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <div className="relative h-7 w-7 shrink-0">
            {/* SVG ring countdown */}
            <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-muted-foreground/20"
              />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 11}`}
                strokeDashoffset={`${2 * Math.PI * 11 * (1 - countdown / seconds)}`}
                strokeLinecap="round"
                className="text-primary transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
              {countdown}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-tight">
            Please review the details above before confirming.
          </p>
        </div>
      )}
      <Button
        className={`w-full ${bgClass} transition-all`}
        disabled={!ready || isPending}
        onClick={onConfirm}
      >
        {isPending ? pendingLabel : ready ? label : `Wait ${countdown}s…`}
      </Button>
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const collapsed = state === "collapsed";
  const showText = isMobile ? true : !collapsed;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Shift-related local state
  const [clockInCash, setClockInCash] = useState("");
  const [clockOutCash, setClockOutCash] = useState("");
  const [clockInOpen, setClockInOpen] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [cashboxOpen, setCashboxOpen] = useState(false);
  const [cashboxForm, setCashboxForm] = useState<CashboxForm>({
    type: "cash_in",
    amount: "",
    reason: "",
  });

  // Day management local state
  const [startDayOpen, setStartDayOpen] = useState(false);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const [dayNotes, setDayNotes] = useState("");

  const {
    isAdmin,
    isCashier,
    isStoreClerk,
    canAccessDashboard,
    canAccessSales,
    canAccessInventory,
    canAccessBookkeeping,
    canAccessEmployees,
    canAccessReports,
  } = useUserRole();

  const roleLabel = isAdmin
    ? "Admin"
    : isStoreClerk
      ? "Store Clerk"
      : isCashier
        ? "Cashier"
        : "User";

  // ── Data queries ─────────────────────────────────────────────────────────────

  const { data: currentEmployee } = useQuery({
    queryKey: ["sidebar-employee"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("employees")
        .select("id, name, role")
        .eq("user_id", user.id)
        .single();
      return data;
    },
  });

  const { data: activeShift } = useQuery({
    queryKey: ["sidebar-active-shift", currentEmployee?.id],
    enabled: !!currentEmployee?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", currentEmployee!.id)
        .is("clock_out", null)
        .maybeSingle();
      return data;
    },
  });

  const { data: lastShift } = useQuery({
    queryKey: ["sidebar-last-shift-any"],
    enabled: !activeShift,
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("ending_cash, clock_out, employees(name)")
        .not("clock_out", "is", null)
        .not("ending_cash", "is", null)
        .order("clock_out", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Today's day log
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: todayDayLog, refetch: refetchDayLog } = useQuery({
    queryKey: ["sidebar-day-log", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("log_date", todayStr)
        .maybeSingle();
      return data;
    },
  });

  // Is any shift currently active store-wide? (to know if day can be closed)
  const { data: anyActiveShift } = useQuery({
    queryKey: ["sidebar-any-active-shift"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("id, employees(name)")
        .is("clock_out", null)
        .limit(5);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const dayStatus: DayStatus = todayDayLog ? "closed" : "open";

  // ── Today's summary for day-closing ──────────────────────────────────────────
  const { data: todayTxSummary } = useQuery({
    queryKey: ["sidebar-today-summary"],
    enabled: endDayOpen,
    queryFn: async () => {
      const start = startOfDay(new Date()).toISOString();
      const end = endOfDay(new Date()).toISOString();
      const [{ data: completed }, { data: refunded }, { data: disposed }] =
        await Promise.all([
          supabase
            .from("transactions")
            .select(
              "total_amount, vat_amount, payment_method, discount_type, discount_amount",
            )
            .gte("created_at", start)
            .lte("created_at", end)
            .eq("status", "completed"),
          supabase
            .from("transactions")
            .select("total_amount, vat_amount")
            .gte("created_at", start)
            .lte("created_at", end)
            .eq("status", "refunded"),
          supabase
            .from("disposed_items")
            .select("total_loss, quantity")
            .gte("disposed_at", start)
            .lte("disposed_at", end),
        ]);

      const revenue = (completed || []).reduce(
        (s, t) => s + Number(t.total_amount),
        0,
      );
      const vat = (completed || []).reduce(
        (s, t) => s + Number(t.vat_amount),
        0,
      );
      const cash = (completed || [])
        .filter((t) => t.payment_method === "cash")
        .reduce((s, t) => s + Number(t.total_amount), 0);
      const card = (completed || [])
        .filter((t) => t.payment_method === "card")
        .reduce((s, t) => s + Number(t.total_amount), 0);
      const discounts = (completed || [])
        .filter((t) => t.discount_type)
        .reduce((s, t) => s + Number(t.discount_amount || 0), 0);
      const refundTotal = (refunded || []).reduce(
        (s, t) => s + Number(t.total_amount),
        0,
      );
      const refundVat = (refunded || []).reduce(
        (s, t) => s + Number(t.vat_amount),
        0,
      );
      const stockLoss = (disposed || []).reduce(
        (s, d) => s + Number(d.total_loss || 0),
        0,
      );
      const netProfit = revenue - vat - refundTotal + refundVat - stockLoss;

      return {
        revenue,
        vat,
        cash,
        card,
        discounts,
        refundTotal,
        refundVat,
        stockLoss,
        netProfit,
        txCount: (completed || []).length,
        refundCount: (refunded || []).length,
        cardSales: card,
        cashSales: cash,
      };
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const clockInMutation = useMutation({
    mutationFn: async (startingCash: number) => {
      const { error } = await supabase.from("shifts").insert({
        employee_id: currentEmployee!.id,
        starting_cash: startingCash,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift started!");
      setClockInOpen(false);
      setClockInCash("");
      queryClient.invalidateQueries({ queryKey: ["sidebar-active-shift"] });
      queryClient.invalidateQueries({ queryKey: ["active-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-any-active-shift"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clockOutMutation = useMutation({
    mutationFn: async (endingCash: number) => {
      if (!activeShift || !currentEmployee) throw new Error("No active shift");
      const { data: empRecord } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", currentEmployee.id)
        .single();
      if (!empRecord?.user_id)
        throw new Error("Employee has no linked user account");

      const { data: cashTx } = await supabase
        .from("transactions")
        .select("total_amount")
        .eq("employee_id", empRecord.user_id)
        .eq("payment_method", "cash")
        .eq("status", "completed")
        .gte("created_at", activeShift.clock_in);

      const { data: cashboxAdjustments } = await supabase
        .from("cashbox_logs")
        .select("type, amount")
        .eq("shift_id", activeShift.id);

      const cashSalesTotal = (cashTx || []).reduce(
        (s, t) => s + Number(t.total_amount),
        0,
      );
      const cashInAdj = (cashboxAdjustments || [])
        .filter((l) => l.type === "cash_in")
        .reduce((s, l) => s + Number(l.amount), 0);
      const cashOutAdj = (cashboxAdjustments || [])
        .filter((l) => l.type === "cash_out")
        .reduce((s, l) => s + Number(l.amount), 0);
      const expectedCash =
        Number(activeShift.starting_cash) +
        cashSalesTotal +
        cashInAdj -
        cashOutAdj;
      const difference = endingCash - expectedCash;

      const { error } = await supabase
        .from("shifts")
        .update({
          clock_out: new Date().toISOString(),
          ending_cash: endingCash,
          expected_cash: expectedCash,
          cash_difference: difference,
        })
        .eq("id", activeShift.id);
      if (error) throw error;
      return activeShift.id;
    },
    onSuccess: (shiftId) => {
      toast.success("Shift ended!");
      setClockOutOpen(false);
      setClockOutCash("");
      queryClient.invalidateQueries({ queryKey: ["sidebar-active-shift"] });
      queryClient.invalidateQueries({ queryKey: ["active-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-any-active-shift"] });
      navigate(`/shift-report/${shiftId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cashboxLogMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployee) throw new Error("No employee found");
      const { error } = await supabase.from("cashbox_logs").insert({
        employee_id: currentEmployee.id,
        shift_id: activeShift?.id || null,
        type: cashboxForm.type as "cash_in" | "cash_out",
        amount: parseFloat(cashboxForm.amount),
        reason: cashboxForm.reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cashbox log recorded");
      setCashboxOpen(false);
      setCashboxForm({ type: "cash_in", amount: "", reason: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Bulk day-close logic ──────────────────────────────────────────────────────
  const closeDayMutation = useMutation({
    mutationFn: async ({
      dateStr,
      notes,
      isAutoClose = false,
    }: {
      dateStr: string;
      notes?: string;
      isAutoClose?: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const start = startOfDay(new Date(dateStr)).toISOString();
      const end = endOfDay(new Date(dateStr)).toISOString();

      const [{ data: completed }, { data: refunded }, { data: disposed }] =
        await Promise.all([
          supabase
            .from("transactions")
            .select(
              "total_amount, vat_amount, payment_method, discount_type, discount_amount",
            )
            .gte("created_at", start)
            .lte("created_at", end)
            .eq("status", "completed"),
          supabase
            .from("transactions")
            .select("total_amount, vat_amount")
            .gte("created_at", start)
            .lte("created_at", end)
            .eq("status", "refunded"),
          supabase
            .from("disposed_items")
            .select("total_loss, quantity")
            .gte("disposed_at", start)
            .lte("disposed_at", end),
        ]);

      const revenue = (completed || []).reduce(
        (s, t) => s + Number(t.total_amount),
        0,
      );
      const vat = (completed || []).reduce(
        (s, t) => s + Number(t.vat_amount),
        0,
      );
      const cash = (completed || [])
        .filter((t) => t.payment_method === "cash")
        .reduce((s, t) => s + Number(t.total_amount), 0);
      const card = (completed || [])
        .filter((t) => t.payment_method === "card")
        .reduce((s, t) => s + Number(t.total_amount), 0);
      const discounts = (completed || [])
        .filter((t) => t.discount_type)
        .reduce((s, t) => s + Number(t.discount_amount || 0), 0);
      const refundTotal = (refunded || []).reduce(
        (s, t) => s + Number(t.total_amount),
        0,
      );
      const refundVat = (refunded || []).reduce(
        (s, t) => s + Number(t.vat_amount),
        0,
      );
      const stockLoss = (disposed || []).reduce(
        (s, d) => s + Number(d.total_loss || 0),
        0,
      );
      const netProfit = revenue - vat - refundTotal + refundVat - stockLoss;

      const logData = {
        log_date: dateStr,
        total_sales: parseFloat(revenue.toFixed(2)),
        transaction_count: (completed || []).length,
        vat_amount: parseFloat(vat.toFixed(2)),
        discount_amount: parseFloat(discounts.toFixed(2)),
        refund_amount: parseFloat(refundTotal.toFixed(2)),
        refund_count: (refunded || []).length,
        cash_sales: parseFloat(cash.toFixed(2)),
        card_sales: parseFloat(card.toFixed(2)),
        stock_loss: parseFloat(stockLoss.toFixed(2)),
        net_profit: parseFloat(netProfit.toFixed(2)),
        closed_by: user?.id || null,
        notes: isAutoClose
          ? `[Auto-closed at 3AM] ${notes || ""}`.trim()
          : notes?.trim() || null,
      };

      const { error } = await supabase
        .from("daily_logs")
        .upsert(logData, { onConflict: "log_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Day closed! Daily summary recorded.");
      setEndDayOpen(false);
      setDayNotes("");
      queryClient.invalidateQueries({ queryKey: ["sidebar-day-log"] });
      queryClient.invalidateQueries({ queryKey: ["bk-daily-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Auto-close at 3AM ──────────────────────────────────────────────────────
  useEffect(() => {
    const checkAutoClose = () => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() === 0 && !todayDayLog) {
        const yesterday = format(
          new Date(now.getTime() - 86400000),
          "yyyy-MM-dd",
        );
        closeDayMutation.mutate({ dateStr: yesterday, isAutoClose: true });
      }
    };
    // Check every minute
    const interval = setInterval(checkAutoClose, 60_000);
    return () => clearInterval(interval);
  }, [closeDayMutation, todayDayLog]);

  // ── Navigation items ──────────────────────────────────────────────────────────
  const navItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      visible: canAccessDashboard,
    },
    {
      title: "Sales",
      url: "/sales",
      icon: ShoppingCart,
      visible: canAccessSales,
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: History,
      visible: canAccessSales,
    },
    {
      title: "Inventory",
      url: "/inventory",
      icon: Package,
      visible: canAccessInventory,
    },
    {
      title: "Employees",
      url: "/employees",
      icon: Users,
      visible: canAccessEmployees,
    },
    {
      title: "Bookkeeping",
      url: "/bookkeeping",
      icon: BookOpen,
      visible: canAccessBookkeeping,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      visible: canAccessReports,
    },
  ];

  const handleLogout = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("session_access").delete().eq("user_id", user.id);
      }
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const fmt = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShoppingCart className="h-4 w-4 text-primary-foreground" />
          </div>
          {showText && (
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground">
                GroceryPOS
              </h2>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* ── Navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems
                .filter((item) => item.visible)
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {showText && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Day Management ── */}
        <SidebarGroup>
          {showText && <SidebarGroupLabel>Store Day</SidebarGroupLabel>}
          <SidebarGroupContent>
            <div className={`space-y-1 ${showText ? "px-2" : "px-1"}`}>
              {/* Day status pill */}
              {showText && (
                <div
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md mb-1 ${
                    dayStatus === "closed"
                      ? "bg-muted/40 border"
                      : "bg-emerald-500/10 border border-emerald-500/20"
                  }`}
                >
                  {dayStatus === "closed" ? (
                    <>
                      <Moon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">
                        Day Closed
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Day Open
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* START DAY — only when day is closed/no record yet */}
              {dayStatus !== "open" && (
                <Popover
                  open={startDayOpen}
                  onOpenChange={(o) => {
                    setStartDayOpen(o);
                    if (!o) setDayNotes("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size={showText ? "default" : "icon"}
                      className="w-full justify-start text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <Sun className="h-4 w-4 shrink-0" />
                      {showText && <span className="ml-2">Start Day</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="right" className="w-80 p-4 space-y-4">
                    {/* Header */}
                    <div className="text-center space-y-1 pb-3 border-b">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                        <Sun className="h-5 w-5 text-emerald-500" />
                      </div>
                      <h4 className="font-semibold text-sm">
                        Good morning! ☀️
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(), "EEEE, MMMM d, yyyy")}
                      </p>
                    </div>

                    {/* Simple note field */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Opening Notes (optional)
                      </Label>
                      <Textarea
                        placeholder="e.g. Holiday shift, skeleton crew, special event…"
                        value={dayNotes}
                        onChange={(e: any) => setDayNotes(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>

                    {/* Countdown confirm */}
                    <CountdownConfirmButton
                      label="Open Store for Today"
                      pendingLabel="Opening…"
                      onConfirm={async () => {
                        toast.success(
                          `Store day opened — ${format(new Date(), "MMMM d, yyyy")}`,
                        );
                        setStartDayOpen(false);
                        setDayNotes("");
                        refetchDayLog();
                      }}
                      isPending={false}
                      variant="success"
                      seconds={10}
                    />

                    <p className="text-[10px] text-muted-foreground text-center leading-tight">
                      Shifts and sales can be recorded once the day is open. The
                      day closes automatically at 3 AM if not closed manually.
                    </p>
                  </PopoverContent>
                </Popover>
              )}

              {/* END DAY — show when day is open */}
              {dayStatus === "open" && (
                <Popover
                  open={endDayOpen}
                  onOpenChange={(o) => {
                    setEndDayOpen(o);
                    if (!o) setDayNotes("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size={showText ? "default" : "icon"}
                      className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                    >
                      <Moon className="h-4 w-4 shrink-0" />
                      {showText && <span className="ml-2">End Day</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="right" className="w-80 p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Moon className="h-4 w-4 text-blue-500" />
                        Close Store Day
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Generates the official daily summary for{" "}
                        <span className="font-medium">
                          {format(new Date(), "MMMM d, yyyy")}
                        </span>{" "}
                        and saves it to the bookkeeping log.
                      </p>
                    </div>

                    {/* Active shifts warning */}
                    {anyActiveShift && anyActiveShift.length > 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          ⚠ {anyActiveShift.length} shift(s) still active
                        </p>
                        {anyActiveShift.map((s: any) => (
                          <p key={s.id} className="text-xs text-amber-600">
                            · {(s.employees as any)?.name || "Unknown"} is still
                            on shift
                          </p>
                        ))}
                        <p className="text-xs text-amber-600 mt-1">
                          You can still close the day — active shifts will
                          continue until ended by the cashier.
                        </p>
                      </div>
                    )}

                    {/* Today's snapshot */}
                    {todayTxSummary ? (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
                        <p className="font-semibold text-muted-foreground mb-2">
                          Today's Summary
                        </p>
                        {[
                          {
                            label: "Gross Revenue",
                            value: fmt(todayTxSummary.revenue),
                            color: "text-emerald-600",
                          },
                          {
                            label: "Cash / Card",
                            value: `${fmt(todayTxSummary.cash)} / ${fmt(todayTxSummary.cardSales)}`,
                          },
                          {
                            label: "Transactions",
                            value: String(todayTxSummary.txCount),
                          },
                          {
                            label: "VAT Collected",
                            value: fmt(todayTxSummary.vat),
                          },
                          {
                            label: "Refunds",
                            value: fmt(todayTxSummary.refundTotal),
                            color: "text-destructive",
                          },
                          {
                            label: "Stock Loss",
                            value: fmt(todayTxSummary.stockLoss),
                            color: "text-destructive",
                          },
                          {
                            label: "Est. Net Profit",
                            value: fmt(todayTxSummary.netProfit),
                            color:
                              todayTxSummary.netProfit >= 0
                                ? "text-emerald-600"
                                : "text-destructive",
                          },
                        ].map((row) => (
                          <div key={row.label} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {row.label}
                            </span>
                            <span className={`font-medium ${row.color || ""}`}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground text-center">
                        Loading today's summary…
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">
                        Closing Notes (optional)
                      </Label>
                      <Textarea
                        placeholder="e.g. All balanced, busy holiday shift…"
                        value={dayNotes}
                        onChange={(e: any) => setDayNotes(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>

                    <CountdownConfirmButton
                      label="Confirm — Close Day"
                      pendingLabel="Closing…"
                      onConfirm={() =>
                        closeDayMutation.mutate({
                          dateStr: todayStr,
                          notes: dayNotes,
                        })
                      }
                      isPending={closeDayMutation.isPending}
                      variant="default"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Shift & Cashbox Controls (only when day is open) ── */}
        {currentEmployee && dayStatus === "open" && (
          <SidebarGroup>
            {showText && <SidebarGroupLabel>My Shift</SidebarGroupLabel>}
            <SidebarGroupContent>
              <div className={`space-y-1 ${showText ? "px-2" : "px-1"}`}>
                {/* Active shift indicator */}
                {showText && activeShift && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-success/10 mb-2">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs text-success font-medium">
                      On Shift
                    </span>
                  </div>
                )}

                {/* Start Shift */}
                {!activeShift && (
                  <Popover open={clockInOpen} onOpenChange={setClockInOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size={showText ? "default" : "icon"}
                        className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      >
                        <Timer className="h-4 w-4 shrink-0" />
                        {showText && <span className="ml-2">Start Shift</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-72 p-4 space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Timer className="h-4 w-4 text-success" /> Start Shift
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the starting cash amount in the cashbox.
                        </p>
                      </div>

                      {lastShift?.ending_cash != null && (
                        <div className="p-3 rounded-lg bg-muted/40 border space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            Previous shift ended with:
                          </p>
                          <p className="text-base font-bold text-success">
                            ₱
                            {Number(lastShift.ending_cash).toLocaleString(
                              "en-PH",
                              { minimumFractionDigits: 2 },
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            by {(lastShift.employees as any)?.name || "—"} ·{" "}
                            {lastShift.clock_out
                              ? format(
                                  new Date(lastShift.clock_out),
                                  "MMM d, h:mm a",
                                )
                              : "—"}
                          </p>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label>Starting Cash (₱)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            ₱
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={clockInCash}
                            onChange={(e) => setClockInCash(e.target.value)}
                            className="pl-7"
                          />
                        </div>
                        {lastShift?.ending_cash != null && (
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={() =>
                              setClockInCash(String(lastShift.ending_cash))
                            }
                          >
                            Use previous ending cash (₱
                            {Number(lastShift.ending_cash).toFixed(2)})
                          </button>
                        )}
                      </div>

                      <Button
                        className="w-full"
                        disabled={!clockInCash || clockInMutation.isPending}
                        onClick={() =>
                          clockInMutation.mutate(parseFloat(clockInCash))
                        }
                      >
                        {clockInMutation.isPending
                          ? "Starting..."
                          : "Start Shift"}
                      </Button>
                    </PopoverContent>
                  </Popover>
                )}

                {/* End Shift */}
                {activeShift && (
                  <Popover open={clockOutOpen} onOpenChange={setClockOutOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size={showText ? "default" : "icon"}
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <TimerOff className="h-4 w-4 shrink-0" />
                        {showText && <span className="ml-2">End Shift</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-72 p-4 space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <TimerOff className="h-4 w-4 text-destructive" /> End
                          Shift
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Count the cash in the cashbox and enter the total
                          below.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label>Ending Cash Count (₱)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            ₱
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={clockOutCash}
                            onChange={(e) => setClockOutCash(e.target.value)}
                            className="pl-7"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          A cashier report will be generated after confirming.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setClockOutOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={!clockOutCash || clockOutMutation.isPending}
                          onClick={() =>
                            clockOutMutation.mutate(parseFloat(clockOutCash))
                          }
                        >
                          {clockOutMutation.isPending ? "Ending..." : "Confirm"}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Cashbox Log */}
                {activeShift && (
                  <Popover open={cashboxOpen} onOpenChange={setCashboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size={showText ? "default" : "icon"}
                        className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      >
                        <DollarSign className="h-4 w-4 shrink-0" />
                        {showText && <span className="ml-2">Cashbox Log</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="right" className="w-80 p-4 space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />{" "}
                          Cashbox Adjustment
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Log any cash added or removed from the cashbox outside
                          of transactions.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Type</Label>
                          <Select
                            value={cashboxForm.type}
                            onValueChange={(v: "cash_in" | "cash_out") =>
                              setCashboxForm({ ...cashboxForm, type: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash_in">
                                <span className="flex items-center gap-2">
                                  <ArrowDownCircle className="h-3.5 w-3.5 text-success" />{" "}
                                  Cash In
                                </span>
                              </SelectItem>
                              <SelectItem value="cash_out">
                                <span className="flex items-center gap-2">
                                  <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" />{" "}
                                  Cash Out
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Amount (₱)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              ₱
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={cashboxForm.amount}
                              onChange={(e) =>
                                setCashboxForm({
                                  ...cashboxForm,
                                  amount: e.target.value,
                                })
                              }
                              className="pl-7"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Reason / Note *</Label>
                          <Textarea
                            placeholder="e.g. Change fund added, petty cash withdrawal…"
                            value={cashboxForm.reason}
                            onChange={(e: any) =>
                              setCashboxForm({
                                ...cashboxForm,
                                reason: e.target.value,
                              })
                            }
                            rows={3}
                            className="resize-none text-sm"
                          />
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        disabled={
                          !cashboxForm.amount ||
                          !cashboxForm.reason.trim() ||
                          cashboxLogMutation.isPending
                        }
                        onClick={() => cashboxLogMutation.mutate()}
                      >
                        {cashboxLogMutation.isPending
                          ? "Saving..."
                          : "Save Log"}
                      </Button>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Day-closed shift nudge ── */}
        {currentEmployee && dayStatus === "closed" && showText && (
          <div className="mx-3 mt-1 px-3 py-2.5 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground leading-snug">
              The store day is closed. Start a new day to begin shifts and
              record sales.
            </p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size={!showText ? "icon" : "default"}
          onClick={handleLogout}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {showText && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

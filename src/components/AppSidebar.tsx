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
  ChevronDown,
  ChevronUp,
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
type CashboxForm = {
  type: "cash_in" | "cash_out";
  amount: string;
  reason: string;
};

// ── Countdown Button ──────────────────────────────────────────────────────────
// function CountdownConfirmButton({
//   label,
//   pendingLabel,
//   onConfirm,
//   isPending,
//   variant = "default",
//   seconds = 10,
// }: {
//   label: string;
//   pendingLabel: string;
//   onConfirm: () => void;
//   isPending: boolean;
//   variant?: "default" | "destructive" | "success";
//   seconds?: number;
// }) {
//   const [countdown, setCountdown] = useState(seconds);
//   const [ready, setReady] = useState(false);
//   const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   useEffect(() => {
//     setCountdown(seconds);
//     setReady(false);
//     intervalRef.current = setInterval(() => {
//       setCountdown((prev) => {
//         if (prev <= 1) {
//           clearInterval(intervalRef.current!);
//           setReady(true);
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//     return () => clearInterval(intervalRef.current!);
//   }, [seconds]);

//   const bgClass =
//     variant === "destructive"
//       ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
//       : variant === "success"
//         ? "bg-emerald-600 hover:bg-emerald-700 text-white"
//         : "bg-primary hover:bg-primary/90 text-primary-foreground";

//   return (
//     <div className="space-y-2">
//       {!ready && (
//         <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
//           <div className="relative h-7 w-7 shrink-0">
//             <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
//               <circle
//                 cx="14"
//                 cy="14"
//                 r="11"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2.5"
//                 className="text-muted-foreground/20"
//               />
//               <circle
//                 cx="14"
//                 cy="14"
//                 r="11"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2.5"
//                 strokeDasharray={`${2 * Math.PI * 11}`}
//                 strokeDashoffset={`${2 * Math.PI * 11 * (1 - countdown / seconds)}`}
//                 strokeLinecap="round"
//                 className="text-primary transition-all duration-1000"
//               />
//             </svg>
//             <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
//               {countdown}
//             </span>
//           </div>
//           <p className="text-xs text-muted-foreground leading-tight">
//             Please review the details above before confirming.
//           </p>
//         </div>
//       )}
//       <Button
//         className={`w-full ${bgClass} transition-all`}
//         disabled={!ready || isPending}
//         onClick={onConfirm}
//       >
//         {isPending ? pendingLabel : ready ? label : `Wait ${countdown}s…`}
//       </Button>
//     </div>
//   );
// }

// ── Inline Panel ──────────────────────────────────────────────────────────────
function InlinePanel({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="mx-2 mb-2 rounded-lg border bg-sidebar shadow-md overflow-hidden">
      <div className="p-3 space-y-3">{children}</div>
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

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: todayDayLog } = useQuery({
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

  // ── Close-day mutation (auto only) ────────────────────────────────────────
  const closeDayMutation = useMutation({
    mutationFn: async ({
      dateStr,
      notes,
    }: {
      dateStr: string;
      notes?: string;
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

      const { error } = await supabase.from("daily_logs").upsert(
        {
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
          notes: notes ?? null,
        },
        { onConflict: "log_date" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success("Previous day auto-closed. Daily summary saved.", {
        description: `Day: ${variables.dateStr}`,
      });
      queryClient.invalidateQueries({ queryKey: ["sidebar-day-log"] });
      queryClient.invalidateQueries({ queryKey: ["bk-daily-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Auto-close: at 2AM nightly OR on morning open (5AM–11AM) ─────────────
  const morningAutoCloseFired = useRef(false);

  useEffect(() => {
    const checkAutoClose = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h === 2 && !todayDayLog) {
        const prevDate = format(
          new Date(now.getTime() - 86400000),
          "yyyy-MM-dd",
        );
        closeDayMutation.mutate({
          dateStr: prevDate,
          notes: `[Auto-closed at 2:${String(m).padStart(2, "0")} AM]`,
        });
      }
    };
    const interval = setInterval(checkAutoClose, 60_000);
    return () => clearInterval(interval);
  }, [closeDayMutation, todayDayLog]);

  useEffect(() => {
    if (morningAutoCloseFired.current) return;
    const now = new Date();
    const h = now.getHours();
    if (h >= 5 && h < 11) {
      const prevDate = format(new Date(now.getTime() - 86400000), "yyyy-MM-dd");
      supabase
        .from("daily_logs")
        .select("id")
        .eq("log_date", prevDate)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            morningAutoCloseFired.current = true;
            closeDayMutation.mutate({
              dateStr: prevDate,
              notes: `[Auto-closed on morning open at ${h}:${String(now.getMinutes()).padStart(2, "0")} AM]`,
            });
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDayLog]);

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

        {/* ── Shift & Cashbox Controls ── */}
        {currentEmployee && (
          <SidebarGroup>
            {showText && <SidebarGroupLabel>My Shift</SidebarGroupLabel>}
            <SidebarGroupContent>
              <div className={`space-y-1 ${showText ? "px-2" : "px-1"}`}>
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
                  <>
                    <Button
                      variant="ghost"
                      size={showText ? "default" : "icon"}
                      className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      onClick={() => {
                        setClockInOpen((v) => !v);
                        setClockOutOpen(false);
                        setCashboxOpen(false);
                      }}
                    >
                      <Timer className="h-4 w-4 shrink-0" />
                      {showText && (
                        <>
                          <span className="ml-2 flex-1 text-left">
                            Start Shift
                          </span>
                          {clockInOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </>
                      )}
                    </Button>
                    <InlinePanel open={clockInOpen}>
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
                    </InlinePanel>
                  </>
                )}

                {/* End Shift */}
                {activeShift && (
                  <>
                    <Button
                      variant="ghost"
                      size={showText ? "default" : "icon"}
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setClockOutOpen((v) => !v);
                        setClockInOpen(false);
                        setCashboxOpen(false);
                      }}
                    >
                      <TimerOff className="h-4 w-4 shrink-0" />
                      {showText && (
                        <>
                          <span className="ml-2 flex-1 text-left">
                            End Shift
                          </span>
                          {clockOutOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </>
                      )}
                    </Button>
                    <InlinePanel open={clockOutOpen}>
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
                    </InlinePanel>
                  </>
                )}

                {/* Cashbox Log */}
                {activeShift && (
                  <>
                    <Button
                      variant="ghost"
                      size={showText ? "default" : "icon"}
                      className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                      onClick={() => {
                        setCashboxOpen((v) => !v);
                        setClockOutOpen(false);
                        setClockInOpen(false);
                      }}
                    >
                      <DollarSign className="h-4 w-4 shrink-0" />
                      {showText && (
                        <>
                          <span className="ml-2 flex-1 text-left">
                            Cashbox Log
                          </span>
                          {cashboxOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </>
                      )}
                    </Button>
                    <InlinePanel open={cashboxOpen}>
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />{" "}
                          Cashbox Adjustment
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Log any cash added or removed outside of transactions.
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
                    </InlinePanel>
                  </>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
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

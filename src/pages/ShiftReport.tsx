/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { useRef, useState } from "react";

const TX_PAGE_SIZE = 10;

export default function ShiftReport() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [txPage, setTxPage] = useState(1);

  const { data: shift, isLoading: shiftLoading } = useQuery({
    queryKey: ["shift-report", shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*, employees(name, role)")
        .eq("id", shiftId!)
        .single();
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["shift-transactions", shiftId, shift?.employee_id],
    enabled: !!shift,
    queryFn: async () => {
      const { data: emp } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", shift!.employee_id)
        .single();
      if (!emp?.user_id) return [];

      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("employee_id", emp.user_id)
        .gte("created_at", shift!.clock_in)
        .lte("created_at", shift!.clock_out || new Date().toISOString())
        .order("created_at");
      return data || [];
    },
  });

  const { data: cashboxLogs } = useQuery({
    queryKey: ["shift-cashbox-logs", shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      const { data } = await supabase
        .from("cashbox_logs")
        .select("*, employees(name)")
        .eq("shift_id", shiftId!)
        .order("created_at");
      return data || [];
    },
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Shift Report</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 20px; font-weight: bold; text-align: center; }
      h2 { font-size: 14px; font-weight: bold; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      p { margin: 3px 0; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; font-size: 11px; }
      th { background: #f5f5f5; font-weight: bold; }
      .right { text-align: right; }
      .center { text-align: center; }
      .summary { display: flex; justify-content: space-between; margin: 4px 0; }
      .bold { font-weight: bold; }
      .green { color: #16a34a; }
      .red { color: #dc2626; }
      .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; }
    </style>
    </head><body>${printRef.current.innerHTML}
    <script>window.onload=function(){window.print();window.close()}<\/script></body></html>`);
    win.document.close();
  };

  if (shiftLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Shift not found.</p>
      </div>
    );
  }

  const completedTx = (transactions || []).filter(
    (t) => t.status === "completed",
  );
  const refundedTx = (transactions || []).filter(
    (t) => t.status === "refunded",
  );
  const cashTx = completedTx.filter((t) => t.payment_method === "cash");
  const cardTx = completedTx.filter((t) => t.payment_method === "card");

  const totalRevenue = completedTx.reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const totalCash = cashTx.reduce((s, t) => s + Number(t.total_amount), 0);
  const totalCard = cardTx.reduce((s, t) => s + Number(t.total_amount), 0);
  const totalRefunds = refundedTx.reduce(
    (s, t) => s + Number(t.total_amount),
    0,
  );
  const totalVat = completedTx.reduce((s, t) => s + Number(t.vat_amount), 0);

  const cashboxIn = (cashboxLogs || [])
    .filter((l) => l.type === "cash_in")
    .reduce((s, l) => s + Number(l.amount), 0);
  const cashboxOut = (cashboxLogs || [])
    .filter((l) => l.type === "cash_out")
    .reduce((s, l) => s + Number(l.amount), 0);

  const startingCash = Number(shift.starting_cash || 0);
  const endingCash = Number(shift.ending_cash || 0);
  const expectedCash = Number(shift.expected_cash || 0);
  const difference = Number(shift.cash_difference || 0);

  const isBalanced = Math.abs(difference) < 0.01;
  const isOver = difference > 0;

  const shiftMinutes = shift.clock_out
    ? differenceInMinutes(new Date(shift.clock_out), new Date(shift.clock_in))
    : 0;
  const shiftHours = Math.floor(shiftMinutes / 60);
  const shiftMins = shiftMinutes % 60;

  const allTx = transactions || [];
  const totalTxPages = Math.ceil(allTx.length / TX_PAGE_SIZE);
  const pagedTx = allTx.slice(
    (txPage - 1) * TX_PAGE_SIZE,
    txPage * TX_PAGE_SIZE,
  );

  const fmt = (n: number) =>
    `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> Print Report
        </Button>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-1 pb-4 border-b">
          <h1 className="text-2xl font-bold">GroceryPOS</h1>
          <p className="text-lg font-semibold">End-of-Shift Cashier Report</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(shift.clock_in), "MMMM d, yyyy (EEEE)")}
          </p>
        </div>

        {/* Shift Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Cashier", value: (shift.employees as any)?.name || "—" },
            {
              label: "Role",
              value: ((shift.employees as any)?.role || "—").replace("_", " "),
            },
            {
              label: "Clock In",
              value: format(new Date(shift.clock_in), "h:mm a"),
            },
            {
              label: "Clock Out",
              value: shift.clock_out
                ? format(new Date(shift.clock_out), "h:mm a")
                : "—",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3 rounded-lg border bg-muted/30 space-y-1"
            >
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold text-sm capitalize">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Total shift duration:
          </span>
          <span className="font-semibold text-sm">
            {shiftHours}h {shiftMins}m
          </span>
        </div>

        <Separator />

        {/* Sales Summary */}
        <div className="space-y-3">
          <h2 className="font-bold text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Sales Summary
          </h2>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    Total Transactions
                  </TableCell>
                  <TableCell className="text-right">
                    {completedTx.length}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Gross Revenue</TableCell>
                  <TableCell className="text-right font-bold text-success">
                    {fmt(totalRevenue)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8 text-muted-foreground">
                    Cash Sales ({cashTx.length} tx)
                  </TableCell>
                  <TableCell className="text-right">{fmt(totalCash)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8 text-muted-foreground">
                    Card Sales ({cardTx.length} tx)
                  </TableCell>
                  <TableCell className="text-right">{fmt(totalCard)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    VAT Collected (12%)
                  </TableCell>
                  <TableCell className="text-right">{fmt(totalVat)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    Net Revenue (ex-VAT)
                  </TableCell>
                  <TableCell className="text-right">
                    {fmt(totalRevenue - totalVat)}
                  </TableCell>
                </TableRow>
                {refundedTx.length > 0 && (
                  <TableRow>
                    <TableCell className="font-medium text-destructive">
                      Refunds ({refundedTx.length} tx)
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -{fmt(totalRefunds)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Separator />

        {/* Cashbox Reconciliation */}
        <div className="space-y-3">
          <h2 className="font-bold text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Cashbox Reconciliation
          </h2>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Starting Cash</TableCell>
                  <TableCell className="text-right">
                    {fmt(startingCash)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8 text-muted-foreground">
                    + Cash Sales
                  </TableCell>
                  <TableCell className="text-right">{fmt(totalCash)}</TableCell>
                </TableRow>
                {cashboxIn > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      + Cashbox In
                    </TableCell>
                    <TableCell className="text-right text-success">
                      {fmt(cashboxIn)}
                    </TableCell>
                  </TableRow>
                )}
                {cashboxOut > 0 && (
                  <TableRow>
                    <TableCell className="pl-8 text-muted-foreground">
                      - Cashbox Out
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -{fmt(cashboxOut)}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className="bg-muted/40">
                  <TableCell className="font-bold">
                    Expected Cash in Box
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {fmt(expectedCash)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    Actual Cash Count
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {fmt(endingCash)}
                  </TableCell>
                </TableRow>
                <TableRow
                  className={isBalanced ? "bg-success/10" : "bg-destructive/10"}
                >
                  <TableCell className="font-bold">
                    {isBalanced
                      ? "✓ Balanced"
                      : isOver
                        ? "▲ Cash Over"
                        : "▼ Cash Short"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold text-lg ${isBalanced ? "text-success" : isOver ? "text-warning" : "text-destructive"}`}
                  >
                    {difference >= 0 ? "+" : ""}
                    {fmt(difference)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-2">
            {isBalanced ? (
              <Badge className="bg-success text-success-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Cash Balanced
              </Badge>
            ) : (
              <Badge
                className={`flex items-center gap-1 ${isOver ? "bg-warning text-warning-foreground" : "bg-destructive text-destructive-foreground"}`}
              >
                <XCircle className="h-3 w-3" />
                {isOver
                  ? `Over by ${fmt(Math.abs(difference))}`
                  : `Short by ${fmt(Math.abs(difference))}`}
              </Badge>
            )}
          </div>
        </div>

        {/* Cashbox Logs */}
        {(cashboxLogs || []).length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h2 className="font-bold text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Cashbox Adjustments
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashboxLogs!.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          {log.type === "cash_in" ? (
                            <Badge className="bg-success/10 text-success border-success/20 flex items-center gap-1 w-fit text-xs">
                              <ArrowDownCircle className="h-3 w-3" /> Cash In
                            </Badge>
                          ) : (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 w-fit text-xs">
                              <ArrowUpCircle className="h-3 w-3" /> Cash Out
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{log.reason}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${log.type === "cash_in" ? "text-success" : "text-destructive"}`}
                        >
                          {log.type === "cash_in" ? "+" : "-"}
                          {fmt(Number(log.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}

        {/* Transaction Log — paginated in UI, full list in print */}
        {allTx.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base">
                  Transaction Log
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({allTx.length} total)
                  </span>
                </h2>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedTx.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(tx.created_at), "h:mm a")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {tx.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {tx.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${tx.status === "completed" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}
                          >
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${tx.status === "refunded" ? "text-destructive" : ""}`}
                        >
                          {fmt(Number(tx.total_amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination controls — hidden from print via CSS */}
                {totalTxPages > 1 && (
                  <div className="print:hidden flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                      {(txPage - 1) * TX_PAGE_SIZE + 1}–
                      {Math.min(txPage * TX_PAGE_SIZE, allTx.length)} of{" "}
                      {allTx.length} transactions
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={txPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {Array.from({ length: totalTxPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalTxPages ||
                            Math.abs(p - txPage) <= 1,
                        )
                        .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                          if (
                            idx > 0 &&
                            (p as number) - (arr[idx - 1] as number) > 1
                          )
                            acc.push("…");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === "…" ? (
                            <span
                              key={`e-${i}`}
                              className="px-1 text-sm text-muted-foreground"
                            >
                              …
                            </span>
                          ) : (
                            <Button
                              key={p}
                              variant={txPage === p ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8 text-xs"
                              onClick={() => setTxPage(p as number)}
                            >
                              {p}
                            </Button>
                          ),
                        )}

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setTxPage((p) => Math.min(totalTxPages, p + 1))
                        }
                        disabled={txPage === totalTxPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Print-only: show all transactions (hidden in browser) */}
              {totalTxPages > 1 && (
                <div className="hidden print:block rounded-lg border overflow-hidden mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTx.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(tx.created_at), "h:mm a")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {tx.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {tx.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs ${tx.status === "completed" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}
                            >
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${tx.status === "refunded" ? "text-destructive" : ""}`}
                          >
                            {fmt(Number(tx.total_amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t space-y-1">
          <p>Report generated by GroceryPOS</p>
          <p>{format(new Date(), "MMMM d, yyyy h:mm a")}</p>
          <p className="font-medium">
            Cashier: {(shift.employees as any)?.name || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

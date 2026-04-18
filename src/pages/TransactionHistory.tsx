/* eslint-disable no-useless-escape */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Search,
  Receipt,
  Eye,
  CalendarIcon,
  ArrowUpDown,
  RotateCcw,
  Undo2,
  Printer,
  Download,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

type SortKey = "created_at" | "total_amount";
type SortDir = "asc" | "desc";

export default function TransactionHistory() {
  const [search, setSearch] = useState("");
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [refundTxId, setRefundTxId] = useState<string | null>(null);
  const [unrefundTxId, setUnrefundTxId] = useState<string | null>(null);
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name")
        .order("name");
      return data || [];
    },
  });

  const { data: transactions } = useQuery({
    queryKey: [
      "transaction-history",
      search,
      paymentFilter,
      statusFilter,
      employeeFilter,
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
    ],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select("*, employees(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) query = query.ilike("id", `%${search}%`);
      if (paymentFilter !== "all")
        query = query.eq("payment_method", paymentFilter as "cash" | "card");
      if (statusFilter !== "all")
        query = query.eq(
          "status",
          statusFilter as "completed" | "refunded" | "voided",
        );
      if (employeeFilter !== "all")
        query = query.eq("employee_id", employeeFilter);
      if (dateFrom)
        query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      if (dateTo)
        query = query.lte("created_at", endOfDay(dateTo).toISOString());
      const { data } = await query;
      return data || [];
    },
  });

  const sortedTransactions = (transactions || []).sort((a, b) => {
    if (sortKey === "created_at") {
      const cmp =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    }
    const cmp = Number(a.total_amount) - Number(b.total_amount);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  };

  // Fetch items for detail/receipt view
  const activeItemsTxId = selectedTxId || receiptTxId;
  const { data: txItems } = useQuery({
    queryKey: ["tx-items", activeItemsTxId],
    enabled: !!activeItemsTxId,
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_items")
        .select("*, products(name)")
        .eq("transaction_id", activeItemsTxId!);
      return data || [];
    },
  });

  const selectedTx = transactions?.find((t) => t.id === selectedTxId);
  const receiptTx = transactions?.find((t) => t.id === receiptTxId);

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: async (txId: string) => {
      const { data: items } = await supabase
        .from("transaction_items")
        .select("product_id, quantity")
        .eq("transaction_id", txId);
      const { error } = await supabase
        .from("transactions")
        .update({ status: "refunded" as const })
        .eq("id", txId);
      if (error) throw error;
      for (const item of items || []) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (product) {
            await supabase
              .from("products")
              .update({
                stock_quantity: product.stock_quantity + item.quantity,
              })
              .eq("id", item.product_id);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Transaction refunded — stock restored");
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      setRefundTxId(null);
    },
    onError: (error: any) => toast.error(error.message),
  });

  // Unrefund mutation: set back to completed + deduct stock again
  const unrefundMutation = useMutation({
    mutationFn: async (txId: string) => {
      const { data: items } = await supabase
        .from("transaction_items")
        .select("product_id, quantity")
        .eq("transaction_id", txId);
      const { error } = await supabase
        .from("transactions")
        .update({ status: "completed" as const })
        .eq("id", txId);
      if (error) throw error;
      for (const item of items || []) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (product) {
            await supabase
              .from("products")
              .update({
                stock_quantity: product.stock_quantity - item.quantity,
              })
              .eq("id", item.product_id);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Refund cancelled — transaction restored to completed");
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      setUnrefundTxId(null);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Receipt</title>
      <style>body{font-family:monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto}
      .center{text-align:center}.bold{font-weight:bold}.flex{display:flex;justify-content:space-between}
      .border{border-top:1px dashed #000;margin:8px 0}.sm{font-size:10px;color:#666}</style>
      </head><body>${receiptRef.current.innerHTML}
      <script>window.onload=function(){window.print();window.close()}<\/script></body></html>
    `);
    printWindow.document.close();
  };

  const handleDownloadReceipt = () => {
    if (!receiptRef.current || !receiptTx) return;
    const content = receiptRef.current.innerText;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receiptTx.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    completed: "bg-success text-success-foreground",
    refunded: "bg-warning text-warning-foreground",
    voided: "bg-destructive text-destructive-foreground",
  };

  const clearFilters = () => {
    setSearch("");
    setPaymentFilter("all");
    setStatusFilter("all");
    setEmployeeFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasFilters =
    search ||
    paymentFilter !== "all" ||
    statusFilter !== "all" ||
    employeeFilter !== "all" ||
    dateFrom ||
    dateTo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transaction History
          </h1>
          <p className="text-muted-foreground">
            {sortedTransactions.length} transactions
          </p>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by transaction ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !dateFrom && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "MMM d") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !dateTo && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "MMM d") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="card">Card</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("created_at")}
                  >
                    Date <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">VAT (12%)</TableHead>
                <TableHead className="text-right">
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("total_amount")}
                  >
                    Total <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.map((tx) => {
                const vatAmount =
                  Number(tx.vat_amount) || (Number(tx.total_amount) * 12) / 112;
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs">
                      {tx.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(tx.created_at), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>{(tx.employees as any)?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tx.payment_method}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      ₱{vatAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₱{Number(tx.total_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {tx.discount_type && (
                        <Badge variant="outline" className="mr-1 text-[10px]">
                          {tx.discount_type.toUpperCase()}
                        </Badge>
                      )}
                      <Badge className={statusColors[tx.status] || ""}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="View Details"
                          onClick={() => setSelectedTxId(tx.id)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Print Receipt"
                          onClick={() => setReceiptTxId(tx.id)}
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                        {isAdmin && tx.status === "completed" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            title="Refund"
                            onClick={() => setRefundTxId(tx.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                        {isAdmin && tx.status === "refunded" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-warning"
                            title="Cancel Refund"
                            onClick={() => setUnrefundTxId(tx.id)}
                          >
                            <Undo2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedTransactions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog
        open={!!selectedTxId}
        onOpenChange={(open) => {
          if (!open) setSelectedTxId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Transaction Details
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono">{selectedTx.id.slice(0, 8)}</span>
                <span className="text-muted-foreground">Date:</span>
                <span>
                  {format(
                    new Date(selectedTx.created_at),
                    "MMM d, yyyy h:mm a",
                  )}
                </span>
                <span className="text-muted-foreground">Payment:</span>
                <span className="capitalize">{selectedTx.payment_method}</span>
                <span className="text-muted-foreground">Status:</span>
                <Badge className={statusColors[selectedTx.status] || ""}>
                  {selectedTx.status}
                </Badge>
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium">Items</p>
                {txItems?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {(item.products as any)?.name || "Unknown"} ×
                      {item.quantity}
                    </span>
                    <span>₱{Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-1 text-sm">
                {selectedTx.discount_type ? (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Original Price</span>
                      <span>
                        ₱{Number(selectedTx.original_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT Removed</span>
                      <span>
                        -₱
                        {(
                          Number(selectedTx.original_amount) -
                          Number(selectedTx.original_amount) / 1.12
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        20% {selectedTx.discount_type.toUpperCase()} Disc.
                      </span>
                      <span>
                        -₱{Number(selectedTx.discount_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT</span>
                      <span>₱0.00 (Exempt)</span>
                    </div>
                    {selectedTx.customer_id_number && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>ID Number</span>
                        <span>{selectedTx.customer_id_number}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Net (excl. VAT)</span>
                      <span>
                        ₱
                        {(
                          (Number(selectedTx.total_amount) * 100) /
                          112
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT (12%)</span>
                      <span>
                        ₱
                        {(
                          Number(selectedTx.vat_amount) ||
                          (Number(selectedTx.total_amount) * 12) / 112
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>₱{Number(selectedTx.total_amount).toFixed(2)}</span>
                </div>
                {selectedTx.payment_method === "cash" &&
                  Number(selectedTx.cash_tendered) > 0 && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Cash Tendered</span>
                        <span>
                          ₱{Number(selectedTx.cash_tendered).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Change</span>
                        <span>
                          ₱{Number(selectedTx.change_amount).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
              </div>
              <div className="flex gap-2">
                {isAdmin && selectedTx.status === "completed" && (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTxId(null);
                      setRefundTxId(selectedTx.id);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Refund
                  </Button>
                )}
                {isAdmin && selectedTx.status === "refunded" && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTxId(null);
                      setUnrefundTxId(selectedTx.id);
                    }}
                  >
                    <Undo2 className="h-4 w-4 mr-2" /> Cancel Refund
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedTxId(null);
                    setReceiptTxId(selectedTx.id);
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" /> Print Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Print Dialog */}
      <Dialog
        open={!!receiptTxId}
        onOpenChange={(open) => {
          if (!open) setReceiptTxId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {receiptTx && (
            <>
              <div ref={receiptRef} className="font-mono text-xs space-y-2">
                <h2 className="text-center font-bold text-sm">GroceryPOS</h2>
                <p className="text-center text-muted-foreground">
                  Transaction #{receiptTx.id.slice(0, 8)}
                </p>
                <p className="text-center text-muted-foreground">
                  {format(new Date(receiptTx.created_at), "MMM d, yyyy h:mm a")}
                </p>
                {receiptTx.status === "refunded" && (
                  <p className="text-center font-bold text-destructive">
                    *** REFUNDED ***
                  </p>
                )}
                {receiptTx.discount_type && (
                  <p className="text-center font-bold">
                    *** {receiptTx.discount_type.toUpperCase()} DISCOUNT ***
                  </p>
                )}
                {receiptTx.customer_id_number && (
                  <p className="text-center text-muted-foreground">
                    ID: {receiptTx.customer_id_number}
                  </p>
                )}
                <div className="border-t border-dashed my-2" />
                {txItems?.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {(item.products as any)?.name || "Unknown"} x
                      {item.quantity}
                    </span>
                    <span>₱{Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-dashed my-2" />
                {receiptTx.discount_type ? (
                  <>
                    <div className="flex justify-between">
                      <span>Original Price</span>
                      <span>
                        ₱{Number(receiptTx.original_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT Removed</span>
                      <span>
                        -₱
                        {(
                          Number(receiptTx.original_amount) -
                          Number(receiptTx.original_amount) / 1.12
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        20% {receiptTx.discount_type.toUpperCase()} Disc.
                      </span>
                      <span>
                        -₱{Number(receiptTx.discount_amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT</span>
                      <span>₱0.00 (Exempt)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Net (excl. VAT)</span>
                      <span>
                        ₱
                        {((Number(receiptTx.total_amount) * 100) / 112).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT (12%)</span>
                      <span>
                        ₱
                        {(
                          Number(receiptTx.vat_amount) ||
                          (Number(receiptTx.total_amount) * 12) / 112
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL</span>
                  <span>₱{Number(receiptTx.total_amount).toFixed(2)}</span>
                </div>
                {receiptTx.discount_type &&
                  Number(receiptTx.discount_amount) > 0 && (
                    <div className="flex justify-between font-bold text-sm">
                      <span>You Saved</span>
                      <span>
                        ₱{Number(receiptTx.discount_amount).toFixed(2)}
                      </span>
                    </div>
                  )}
                {receiptTx.payment_method === "cash" &&
                  Number(receiptTx.cash_tendered) > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span>Cash Tendered</span>
                        <span>
                          ₱{Number(receiptTx.cash_tendered).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Change</span>
                        <span>
                          ₱{Number(receiptTx.change_amount).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                <p className="text-center mt-1">
                  Paid via {receiptTx.payment_method}
                </p>
                <p className="text-center text-muted-foreground">
                  Cashier: {(receiptTx.employees as any)?.name || "—"}
                </p>
                <p className="text-center text-muted-foreground mt-2">
                  Thank you for shopping!
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={handlePrintReceipt} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadReceipt}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation */}
      <AlertDialog
        open={!!refundTxId}
        onOpenChange={(open) => {
          if (!open) setRefundTxId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to refund this transaction? The stock
              quantities will be restored and the revenue will be adjusted in
              reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => refundTxId && refundMutation.mutate(refundTxId)}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? "Processing..." : "Confirm Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Refund Confirmation */}
      <AlertDialog
        open={!!unrefundTxId}
        onOpenChange={(open) => {
          if (!open) setUnrefundTxId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this refund? The transaction will
              be restored to "completed" and the stock quantities will be
              deducted again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                unrefundTxId && unrefundMutation.mutate(unrefundTxId)
              }
              disabled={unrefundMutation.isPending}
            >
              {unrefundMutation.isPending
                ? "Processing..."
                : "Confirm Cancel Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

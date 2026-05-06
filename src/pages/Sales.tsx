/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { type Tables } from "@/integrations/supabase/types";
import { differenceInDays } from "date-fns";
import BarcodeScanner from "@/components/BarcodeScanner";
import CartBody from "@/components/sales/CartBody";
import { resolveEmployee } from "@/lib/resolveEmployee";
import { format } from "date-fns";

type Product = Tables<"products">;

interface CartItem {
  product: Product;
  quantity: number;
}

const ITEMS_PER_PAGE = 24;

type DiscountType = "none" | "pwd" | "senior";
type FlashState = { id: string; type: "success" | "error" } | null;

export default function Sales() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [showCalc, setShowCalc] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [customerIdNumber, setCustomerIdNumber] = useState("");
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [flashState, setFlashState] = useState<FlashState>(null);

  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter]);

  const { data: categories } = useQuery({
    queryKey: ["sales-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      return data || [];
    },
  });

  // 1. Seed query — runs first, once
  const { isSuccess: isSeedDone } = useQuery({
    queryKey: ["seed-products"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!navigator.onLine) return true;
      const { data } = await supabase.from("products").select("*");
      if (data?.length) {
        await db.products.bulkPut(
          data.map((p) => ({
            ...p,
            category_id: p.category_id ?? undefined,
            is_active: p.is_active ?? undefined,
            barcode: p.barcode ?? undefined,
            sku: p.sku ?? undefined,
            cost_price: p.cost_price ?? undefined,
            discount_percentage: p.discount_percentage ?? undefined,
            stock_quantity: p.stock_quantity ?? undefined,
            _sync_status: "synced" as const,
            _sync_error: null,
          })),
        );
      }
      return true;
    },
  });

  // ── Products query — Dexie first ──────────────────────────────────────────
  // 2. Products query — waits for seed, reads ONLY from Dexie
  const { data: products, isLoading: isProductsLoading } = useQuery({
    queryKey: ["sales-products", search, categoryFilter],
    enabled: isSeedDone,
    queryFn: async () => {
      let data: any[] = await db.products.toArray();

      data = data.filter((p) => p.is_active === true || p.is_active === 1);

      data = data.filter((p) => p.stock_quantity > 0);

      if (search) {
        const s = search.toLowerCase();
        data = data.filter(
          (p) =>
            p.name?.toLowerCase().includes(s) ||
            p.barcode?.toLowerCase().includes(s) ||
            p.sku?.toLowerCase().includes(s),
        );
      }

      if (categoryFilter !== "all")
        data = data.filter((p) => p.category_id === categoryFilter);

      return data.sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const totalPages = Math.ceil((products?.length || 0) / ITEMS_PER_PAGE);
  const paginatedProducts = (products || []).slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const getExpiryStatus = (product: Product) => {
    if (!product.expiry_date) return "none";
    const daysLeft = differenceInDays(
      new Date(product.expiry_date),
      new Date(),
    );
    if (daysLeft <= 0) return "expired";
    if (daysLeft <= 7) return "critical";
    if (daysLeft <= 30) return "near_expiry";
    return "good";
  };

  const getExpiryBadge = (product: Product) => {
    const status = getExpiryStatus(product);
    if (status === "expired")
      return (
        <Badge variant="destructive" className="text-[10px]">
          Expired
        </Badge>
      );
    if (status === "critical")
      return (
        <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]">
          ≤7d
        </Badge>
      );
    if (status === "near_expiry")
      return (
        <Badge className="bg-warning text-warning-foreground text-[10px]">
          Near Expiry
        </Badge>
      );
    return null;
  };

  const flashCard = (productId: string, type: "success" | "error") => {
    setFlashState({ id: productId, type });
    setTimeout(() => setFlashState(null), 600);
  };

  const addToCart = useCallback(
    (product: Product, fromBarcode = false) => {
      const expiry = getExpiryStatus(product);
      if (expiry === "expired") {
        flashCard(product.id, "error");
        if (!fromBarcode)
          toast.error("This product is expired and cannot be sold");
        return false;
      }
      let success = true;
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          if (existing.quantity >= product.stock_quantity) {
            if (!fromBarcode) toast.error("Not enough stock");
            success = false;
            return prev;
          }
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        return [...prev, { product, quantity: 1 }];
      });
      flashCard(product.id, success ? "success" : "error");
      return success;
    },
    [products],
  );

  const handleBarcodeScan = useCallback(
    (barcode: string): boolean => {
      const product = products?.find((p) => p.barcode === barcode);
      if (!product) return false;
      return addToCart(product, true);
    },
    [products, addToCart],
  );

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty > item.product.stock_quantity) {
            toast.error("Not enough stock");
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => {
    const price = Number(item.product.price);
    const nearExpiryDiscount = Number(item.product.discount_percentage) || 0;
    const effectivePrice =
      nearExpiryDiscount > 0 ? price * (1 - nearExpiryDiscount / 100) : price;
    return sum + effectivePrice * item.quantity;
  }, 0);

  const isDiscounted = discountType !== "none";
  const vatExemptSubtotal = cartSubtotal / 1.12;
  const pwdSeniorDiscount = vatExemptSubtotal * 0.2;
  const discountedTotal = vatExemptSubtotal - pwdSeniorDiscount;
  const cartTotal = isDiscounted ? discountedTotal : cartSubtotal;
  const vatAmount = isDiscounted ? 0 : (cartSubtotal * 12) / 112;
  const netAmount = isDiscounted ? discountedTotal : cartSubtotal - vatAmount;
  const discountAmount = isDiscounted ? cartSubtotal - discountedTotal : 0;
  const changeAmount = cashTendered - cartTotal;

  // ── Checkout — Dexie first, then Supabase sync ─────────────────────────────
  const checkoutMutation = useMutation({
    mutationFn: async (paymentMethod: "cash" | "card") => {
      if (isDiscounted && !customerIdNumber.trim())
        throw new Error(
          "Please enter the customer's PWD/Senior Citizen ID number",
        );

      const { userId, employeeName } = await resolveEmployee();

      const cashTenderedValue =
        paymentMethod === "cash" ? parseFloat(cashTendered.toFixed(2)) : 0;
      const changeValue =
        paymentMethod === "cash"
          ? parseFloat((cashTendered - cartTotal).toFixed(2))
          : 0;

      // Generate IDs locally so Dexie and Supabase share the same IDs
      const txId = crypto.randomUUID();
      const now = new Date().toISOString();

      const txRecord = {
        id: txId,
        employee_id: userId,
        created_at: now,
        total_amount: parseFloat(cartTotal.toFixed(2)),
        payment_method: paymentMethod,
        status: "completed",
        vat_amount: parseFloat(vatAmount.toFixed(2)),
        discount_type: isDiscounted ? discountType : null,
        discount_amount: parseFloat(discountAmount.toFixed(2)),
        original_amount: parseFloat(cartSubtotal.toFixed(2)),
        customer_id_number: isDiscounted ? customerIdNumber.trim() : null,
        cash_tendered: cashTenderedValue,
        change_amount: changeValue,
      };

      const itemRecords = cart.map((item) => ({
        id: crypto.randomUUID(),
        transaction_id: txId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: Number(item.product.price),
        subtotal: Number(item.product.price) * item.quantity,
        created_at: now,
        product_name: item.product.name, // store name for offline receipt
      }));

      const dexieRecord = {
        ...txRecord,
        status: txRecord.status as "completed" | "refunded" | "voided",
        _sync_status: "pending" as const,
        _sync_error: null,
      };
      await db.transactions.put(dexieRecord);
      await db.transaction_items.bulkPut(
        itemRecords.map((item) => ({
          ...item,
          _sync_status: "pending" as const,
          _sync_error: null,
        })),
      );
      for (const item of cart) {
        await db.products.update(item.product.id, {
          stock_quantity: item.product.stock_quantity - item.quantity,
        });
      }

      if (navigator.onLine) {
        try {
          const {
            _sync_status: _s,
            _sync_error: _e,
            ...supabasePayload
          } = dexieRecord;

          // ── Insert transaction ──────────────────────────────────────────
          const { error: txError } = await supabase
            .from("transactions")
            .upsert(supabasePayload, { onConflict: "id" });

          if (txError) {
            // ✅ Log the full error so you can see exactly what column is wrong
            console.error("[Checkout] Transaction insert failed:", {
              code: txError.code,
              message: txError.message,
              details: txError.details,
              hint: txError.hint,
              payload: supabasePayload, // ✅ see exactly what was sent
            });
            throw txError;
          }

          // ── Insert transaction items ────────────────────────────────────
          const itemsPayload = itemRecords.map(
            ({ product_name, _sync_status, _sync_error, ...rest }: any) => rest,
          );
          const { error: itemsError } = await supabase
            .from("transaction_items")
            .upsert(itemsPayload, { onConflict: "id" });

          if (itemsError) {
            console.error("[Checkout] Items insert failed:", {
              code: itemsError.code,
              message: itemsError.message,
              details: itemsError.details,
              hint: itemsError.hint,
              payload: itemsPayload,
            });
            throw itemsError;
          }

          // ── Update product stock ────────────────────────────────────────
          for (const item of cart) {
            const newQty = item.product.stock_quantity - item.quantity;
            const { error: stockError } = await supabase
              .from("products")
              .update({ stock_quantity: newQty })
              .eq("id", item.product.id);

            if (stockError) {
              console.error("[Checkout] Stock update failed:", {
                product_id: item.product.id,
                message: stockError.message,
              });
              // Non-fatal — don't throw, stock will reconcile on next sync
            }
          }

          // ── Mark synced ─────────────────────────────────────────────────
          await db.transactions.update(txId, {
            _sync_status: "synced",
            _sync_error: null,
          });
          await db.transaction_items
            .where("transaction_id")
            .equals(txId)
            .modify({ _sync_status: "synced", _sync_error: null });
        } catch (supabaseError: any) {
          await db.transactions.update(txId, {
            _sync_status: "error",
            _sync_error: supabaseError?.message ?? String(supabaseError),
          });
          console.warn(
            "[Checkout] Supabase sync failed, saved to Dexie for retry:",
            supabaseError,
          );
          // ✅ Don't re-throw — Dexie has it, receipt should still show
        }
      }

      return {
        id: txId,
        created_at: now,
        total: cartTotal,
        vat: vatAmount,
        net: netAmount,
        method: paymentMethod,
        discountType: isDiscounted ? discountType : null,
        discountAmount,
        originalAmount: cartSubtotal,
        customerIdNumber: isDiscounted ? customerIdNumber.trim() : null,
        cashierName: employeeName,
      };
    },
    onSuccess: (data) => {
      setLastTransaction({
        ...data,
        items: [...cart],
        cashTendered: data.method === "cash" ? cashTendered : undefined,
        change: data.method === "cash" ? cashTendered - data.total : undefined,
      });
      setShowReceipt(true);
      setCart([]);
      setCashTendered(0);
      setShowCalc(false);
      setDiscountType("none");
      setCustomerIdNumber("");
      queryClient.invalidateQueries({ queryKey: ["sales-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Transaction completed!");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleCashCheckout = () => {
    if (cashTendered < cartTotal) {
      toast.error("Insufficient cash tendered");
      return;
    }
    checkoutMutation.mutate("cash");
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Receipt</title>
        <style>body{font-family:monospace;max-width:300px;margin:0 auto;padding:20px;font-size:12px}
        h2{text-align:center;margin:0}p{margin:4px 0}.line{border-top:1px dashed #000;margin:8px 0}
        .item{display:flex;justify-content:space-between}.total{font-weight:bold;font-size:14px}</style>
        </head><body>${receiptRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const handleDownloadReceipt = () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;
    const blob = new Blob(
      [
        `<html><head><style>
      body{font-family:monospace;max-width:300px;margin:0 auto;padding:20px;font-size:12px}
      h2{text-align:center;margin:0}p{margin:4px 0}.line{border-top:1px dashed #000;margin:8px 0}
      .item{display:flex;justify-content:space-between}.total{font-weight:bold;font-size:14px}
    </style></head><body>${content}</body></html>`,
      ],
      { type: "text/html" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${lastTransaction?.id?.slice(0, 8) || "tx"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Product grid (shared, slightly different sizing per breakpoint) ─────────
  const ProductGrid = ({ compact = false }: { compact?: boolean }) => (
    <div
      className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}
    >
      {isProductsLoading
        ? // Skeleton cards
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-lg border bg-muted animate-pulse ${compact ? "p-3" : "p-4"}`}
            >
              <div className="h-3 bg-muted-foreground/20 rounded w-3/4 mb-2" />
              <div className="h-5 bg-muted-foreground/20 rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted-foreground/20 rounded w-1/3" />
            </div>
          ))
        : paginatedProducts.map((product) => {
            const expiry = getExpiryStatus(product);
            const isExpired = expiry === "expired";
            const nearExpiryDisc = Number(product.discount_percentage) || 0;
            const isFlashing = flashState?.id === product.id;
            return (
              <button
                key={product.id}
                onClick={() => !isExpired && addToCart(product)}
                disabled={isExpired}
                className={[
                  "rounded-lg border text-left transition-colors select-none",
                  compact ? "p-3" : "p-4",
                  isExpired
                    ? "opacity-50 cursor-not-allowed bg-muted"
                    : "bg-card hover:border-primary/50 hover:shadow-sm active:scale-95",
                  isFlashing && flashState?.type === "success"
                    ? "flash-success"
                    : "",
                  isFlashing && flashState?.type === "error"
                    ? "flash-error"
                    : "",
                ].join(" ")}
                style={{ transition: "transform 0.1s" }}
              >
                <div className="flex items-start justify-between gap-1">
                  <p
                    className={`font-medium truncate flex-1 ${compact ? "text-xs" : "text-sm"}`}
                  >
                    {product.name}
                  </p>
                  {getExpiryBadge(product)}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <p
                    className={`font-semibold text-success ${compact ? "text-sm" : "text-lg"}`}
                  >
                    ₱
                    {nearExpiryDisc > 0
                      ? (
                          Number(product.price) *
                          (1 - nearExpiryDisc / 100)
                        ).toFixed(2)
                      : Number(product.price).toFixed(2)}
                  </p>
                  {nearExpiryDisc > 0 && (
                    <p className="text-xs text-muted-foreground line-through">
                      ₱{Number(product.price).toFixed(2)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {product.stock_quantity} in stock
                  {nearExpiryDisc > 0 && (
                    <span className="text-warning ml-1">
                      • {nearExpiryDisc}% off
                    </span>
                  )}
                </p>
              </button>
            );
          })}

      {!isProductsLoading && paginatedProducts.length === 0 && (
        <p
          className={`col-span-full text-center text-muted-foreground py-8 text-sm`}
        >
          No products found
        </p>
      )}
    </div>
  );

  // ── Pagination bar ──────────────────────────────────────────────────────────
  const PaginationBar = ({ compact = false }: { compact?: boolean }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-1">
        <p
          className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
        >
          {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
          {Math.min(currentPage * ITEMS_PER_PAGE, products?.length || 0)} of{" "}
          {products?.length}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className={compact ? "h-7 w-7" : "h-8 w-8"}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
          {compact ? (
            <span className="text-xs text-muted-foreground px-2">
              {currentPage} / {totalPages}
            </span>
          ) : (
            Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
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
                    variant={currentPage === p ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setCurrentPage(p as number)}
                  >
                    {p}
                  </Button>
                ),
              )
          )}
          <Button
            variant="outline"
            size="icon"
            className={compact ? "h-7 w-7" : "h-8 w-8"}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        </div>
      </div>
    );
  };
  return (
    <>
      <style>{`
          @keyframes flash-success {
            0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); background-color: rgba(34,197,94,0.12); }
            50%  { box-shadow: 0 0 0 6px rgba(34,197,94,0); background-color: rgba(34,197,94,0.22); }
            100% { box-shadow: 0 0 0 0 rgba(34,197,94,0);   background-color: transparent; }
          }
          @keyframes flash-error {
            0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); background-color: rgba(239,68,68,0.12); }
            50%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); background-color: rgba(239,68,68,0.22); }
            100% { box-shadow: 0 0 0 0 rgba(239,68,68,0);   background-color: transparent; }
          }
          .flash-success { animation: flash-success 0.6s ease-out forwards; }
          .flash-error   { animation: flash-error   0.6s ease-out forwards; }
        `}</style>

      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>

        {/* ══════════════════════════════════════════════════
              MOBILE layout  (hidden on lg+)
              Order: 1) Barcode  2) Cart block  3) Products
              ══════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 lg:hidden">
          {/* 1 — Barcode scanner */}
          <BarcodeScanner onScan={handleBarcodeScan} />

          {/* 2 — Cart (inline block, self-contained scroll) */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base flex items-center justify-between">
                <span>
                  Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <CartBody
                cart={cart}
                discountType={discountType}
                customerIdNumber={customerIdNumber}
                setCustomerIdNumber={setCustomerIdNumber}
                setDiscountType={setDiscountType}
                showCalc={showCalc}
                setShowCalc={setShowCalc}
                cashTendered={cashTendered}
                setCashTendered={setCashTendered}
                cartSubtotal={cartSubtotal}
                vatExemptSubtotal={vatExemptSubtotal}
                pwdSeniorDiscount={pwdSeniorDiscount}
                cartTotal={cartTotal}
                vatAmount={vatAmount}
                netAmount={netAmount}
                discountAmount={discountAmount}
                changeAmount={changeAmount}
                checkoutMutation={checkoutMutation}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                handleCashCheckout={handleCashCheckout}
              />
            </CardContent>
          </Card>

          {/* 3 — Product search + grid */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Products — tap to add
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, barcode, or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ProductGrid compact />
            <PaginationBar compact />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
              DESKTOP layout  (hidden below lg)
              Left 3/5: barcode + search + products
              Right 2/5: sticky cart, self-contained scroll
              ══════════════════════════════════════════════════ */}
        <div className="hidden lg:grid lg:grid-cols-5 gap-6">
          {/* Left — barcode + products */}
          <div className="lg:col-span-3 space-y-4">
            <BarcodeScanner onScan={handleBarcodeScan} />

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, barcode, or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ProductGrid />
            <PaginationBar />
          </div>

          {/* Right — sticky cart, own internal scroll */}
          <div className="lg:col-span-2">
            <Card
              className="sticky top-6 flex flex-col"
              style={{ maxHeight: "calc(100vh - 5rem)" }}
            >
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)
                  </span>
                </CardTitle>
              </CardHeader>
              {/* This div is the only thing that scrolls on desktop */}
              <CardContent
                className="flex-1 overflow-y-auto pt-0"
                style={{ minHeight: 0 }}
              >
                <CartBody
                  cart={cart}
                  discountType={discountType}
                  customerIdNumber={customerIdNumber}
                  setCustomerIdNumber={setCustomerIdNumber}
                  setDiscountType={setDiscountType}
                  showCalc={showCalc}
                  setShowCalc={setShowCalc}
                  cashTendered={cashTendered}
                  setCashTendered={setCashTendered}
                  cartSubtotal={cartSubtotal}
                  vatExemptSubtotal={vatExemptSubtotal}
                  pwdSeniorDiscount={pwdSeniorDiscount}
                  cartTotal={cartTotal}
                  vatAmount={vatAmount}
                  netAmount={netAmount}
                  discountAmount={discountAmount}
                  changeAmount={changeAmount}
                  checkoutMutation={checkoutMutation}
                  updateQuantity={updateQuantity}
                  removeFromCart={removeFromCart}
                  handleCashCheckout={handleCashCheckout}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Receipt dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {lastTransaction && (
            <>
              <div ref={receiptRef} className="font-mono text-xs space-y-2">
                <h2 className="text-center font-bold text-sm">GroceryPOS</h2>
                <p className="text-center text-muted-foreground">
                  Transaction #{lastTransaction.id.slice(0, 8)}
                </p>
                <p className="text-center text-muted-foreground">
                  {format(
                    new Date(lastTransaction.created_at),
                    "MMM d, yyyy h:mm a",
                  )}
                </p>
                {lastTransaction.status === "refunded" && (
                  <p className="text-center font-bold text-destructive">
                    *** REFUNDED ***
                  </p>
                )}
                {lastTransaction.discountType && (
                  <p className="text-center font-bold">
                    *** {lastTransaction.discountType.toUpperCase()} DISCOUNT
                    ***
                  </p>
                )}
                {lastTransaction.customerIdNumber && (
                  <p className="text-center text-muted-foreground">
                    ID: {lastTransaction.customerIdNumber}
                  </p>
                )}
                <div className="border-t border-dashed my-2" />
                {lastTransaction.items.map((item: CartItem, i: number) => {
                  const nearExpiryDisc =
                    Number(item.product.discount_percentage) || 0;
                  const effectivePrice =
                    nearExpiryDisc > 0
                      ? Number(item.product.price) * (1 - nearExpiryDisc / 100)
                      : Number(item.product.price);
                  return (
                    <div key={i}>
                      <div className="flex justify-between">
                        <span>
                          {item.product.name} x{item.quantity}
                        </span>
                        <span>
                          ₱{(effectivePrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      {nearExpiryDisc > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Near-expiry: -{nearExpiryDisc}%
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className="border-t border-dashed my-2" />
                {lastTransaction.discountType ? (
                  <>
                    <div className="flex justify-between">
                      <span>Original Price</span>
                      <span>₱{lastTransaction.originalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT Removed</span>
                      <span>
                        -₱
                        {(
                          lastTransaction.originalAmount -
                          lastTransaction.originalAmount / 1.12
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        20% {lastTransaction.discountType.toUpperCase()} Disc.
                      </span>
                      <span>-₱{lastTransaction.discountAmount.toFixed(2)}</span>
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
                      <span>₱{lastTransaction.net.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT (12%)</span>
                      <span>₱{lastTransaction.vat.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="border-t border-dashed my-2" />
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL</span>
                  <span>₱{lastTransaction.total.toFixed(2)}</span>
                </div>
                {lastTransaction.discountType &&
                  lastTransaction.discountAmount > 0 && (
                    <div className="flex justify-between font-bold text-sm">
                      <span>You Saved</span>
                      <span>₱{lastTransaction.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                {lastTransaction.method === "cash" &&
                  lastTransaction.cashTendered != null && (
                    <>
                      <div className="flex justify-between">
                        <span>Cash Tendered</span>
                        <span>₱{lastTransaction.cashTendered.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Change</span>
                        <span>₱{(lastTransaction.change ?? 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                <p className="text-center mt-1">
                  Paid via {lastTransaction.method}
                </p>
                <p className="text-center text-muted-foreground">
                  Cashier: {lastTransaction.cashierName || "—"}
                </p>
                <p className="text-center text-muted-foreground mt-2">
                  Thank you for shopping!
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={handlePrint} className="flex-1">
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
    </>
  );
}

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  const { data: products } = useQuery({
    queryKey: ["sales-products", search, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("name");
      if (search)
        query = query.or(
          `name.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`,
        );
      if (categoryFilter !== "all")
        query = query.eq("category_id", categoryFilter);
      const { data } = await query;
      return data || [];
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

  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("employees")
        .select("name")
        .eq("user_id", user.id)
        .single();
      return data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (paymentMethod: "cash" | "card") => {
      if (isDiscounted && !customerIdNumber.trim())
        throw new Error(
          "Please enter the customer's PWD/Senior Citizen ID number",
        );
      const cashTenderedValue =
        paymentMethod === "cash" ? parseFloat(cashTendered.toFixed(2)) : 0;
      const changeValue =
        paymentMethod === "cash"
          ? parseFloat((cashTendered - cartTotal).toFixed(2))
          : 0;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          employee_id: user.id,
          total_amount: parseFloat(cartTotal.toFixed(2)),
          payment_method: paymentMethod,
          vat_amount: parseFloat(vatAmount.toFixed(2)),
          discount_type: isDiscounted ? discountType : null,
          discount_amount: parseFloat(discountAmount.toFixed(2)),
          original_amount: parseFloat(cartSubtotal.toFixed(2)),
          customer_id_number: isDiscounted ? customerIdNumber.trim() : null,
          cash_tendered: cashTenderedValue,
          change_amount: changeValue,
        })
        .select()
        .single();
      if (txError) throw txError;
      const { error: itemsError } = await supabase
        .from("transaction_items")
        .insert(
          cart.map((item) => ({
            transaction_id: transaction.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: Number(item.product.price),
            subtotal: Number(item.product.price) * item.quantity,
          })),
        );
      if (itemsError) throw itemsError;
      for (const item of cart) {
        const { error } = await supabase
          .from("products")
          .update({
            stock_quantity: item.product.stock_quantity - item.quantity,
          })
          .eq("id", item.product.id);
        if (error) throw error;
      }
      return {
        id: transaction.id,
        created_at: transaction.created_at,
        total: cartTotal,
        vat: vatAmount,
        net: netAmount,
        method: paymentMethod,
        discountType: isDiscounted ? discountType : null,
        discountAmount,
        originalAmount: cartSubtotal,
        customerIdNumber: isDiscounted ? customerIdNumber.trim() : null,
      };
    },
    onSuccess: (data) => {
      setLastTransaction({
        ...data,
        items: [...cart],
        cashTendered: data.method === "cash" ? cashTendered : undefined,
        change: data.method === "cash" ? cashTendered - data.total : undefined,
        cashierName: currentEmployee?.name,
      });
      setShowReceipt(true);
      setCart([]);
      setCashTendered(0);
      setShowCalc(false);
      setDiscountType("none");
      setCustomerIdNumber("");
      queryClient.invalidateQueries({ queryKey: ["sales-products"] });
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
      {paginatedProducts.map((product) => {
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
              isFlashing && flashState?.type === "error" ? "flash-error" : "",
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
      {paginatedProducts.length === 0 && (
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

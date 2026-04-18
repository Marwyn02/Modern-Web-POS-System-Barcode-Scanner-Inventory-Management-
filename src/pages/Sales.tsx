/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback } from "react";
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
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Printer,
  Calculator,
  UserCheck,
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

type Product = Tables<"products">;

interface CartItem {
  product: Product;
  quantity: number;
}

const QUICK_CASH = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

type DiscountType = "none" | "pwd" | "senior";

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
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);

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
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`,
        );
      }
      if (categoryFilter !== "all")
        query = query.eq("category_id", categoryFilter);
      const { data } = await query.limit(30);
      return data || [];
    },
  });

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

  const addToCart = (product: Product) => {
    const expiry = getExpiryStatus(product);
    if (expiry === "expired") {
      toast.error("This product is expired and cannot be sold");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error("Not enough stock");
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
  };

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

  // Price calculations with discount
  const cartSubtotal = cart.reduce((sum, item) => {
    const price = Number(item.product.price);
    const nearExpiryDiscount = Number(item.product.discount_percentage) || 0;
    const effectivePrice =
      nearExpiryDiscount > 0 ? price * (1 - nearExpiryDiscount / 100) : price;
    return sum + effectivePrice * item.quantity;
  }, 0);

  const handleBarcodeScan = useCallback(
    (barcode: string): boolean => {
      // Look up the barcode against the already-fetched products list
      const product = products?.find((p) => p.barcode === barcode);

      if (!product) return false; // tells BarcodeScanner to show "Not Found"

      addToCart(product); // reuses your existing cart logic (stock check, expiry check, etc.)
      return true; // tells BarcodeScanner to show "Added to Cart"
    },
    [products, addToCart],
  );

  const isDiscounted = discountType !== "none";
  // PWD/Senior: VAT-exempt + 20% discount on original price
  // Step 1: Remove VAT (price / 1.12), Step 2: Apply 20% discount
  const vatExemptSubtotal = cartSubtotal / 1.12;
  const pwdSeniorDiscount = vatExemptSubtotal * 0.2;
  const discountedTotal = vatExemptSubtotal - pwdSeniorDiscount;

  const cartTotal = isDiscounted ? discountedTotal : cartSubtotal;
  const vatAmount = isDiscounted ? 0 : (cartSubtotal * 12) / 112;
  const netAmount = isDiscounted ? discountedTotal : cartSubtotal - vatAmount;
  const discountAmount = isDiscounted ? cartSubtotal - discountedTotal : 0;
  const changeAmount = cashTendered - cartTotal;

  const checkoutMutation = useMutation({
    mutationFn: async (paymentMethod: "cash" | "card") => {
      if (isDiscounted && !customerIdNumber.trim()) {
        throw new Error(
          "Please enter the customer's PWD/Senior Citizen ID number",
        );
      }

      const cashTenderedValue =
        paymentMethod === "cash" ? parseFloat(cashTendered.toFixed(2)) : 0;
      const changeValue =
        paymentMethod === "cash"
          ? parseFloat((cashTendered - cartTotal).toFixed(2))
          : 0;

      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
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

      const items = cart.map((item) => ({
        transaction_id: transaction.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: Number(item.product.price),
        subtotal: Number(item.product.price) * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("transaction_items")
        .insert(items);
      if (itemsError) throw itemsError;

      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("products")
          .update({
            stock_quantity: item.product.stock_quantity - item.quantity,
          })
          .eq("id", item.product.id);
        if (stockError) throw stockError;
      }

      return {
        id: transaction.id,
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
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleCashCheckout = () => {
    if (cashTendered < cartTotal) {
      toast.error("Insufficient cash tendered");
      return;
    }
    checkoutMutation.mutate("cash");
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Receipt</title>
          <style>body{font-family:monospace;max-width:300px;margin:0 auto;padding:20px;font-size:12px}
          h2{text-align:center;margin:0}p{margin:4px 0}.line{border-top:1px dashed #000;margin:8px 0}
          .item{display:flex;justify-content:space-between}.total{font-weight:bold;font-size:14px}</style>
          </head><body>${receiptRef.current.innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Product Search */}
        <div className="lg:col-span-3 space-y-4">
          <BarcodeScanner onScan={handleBarcodeScan} />{" "}
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {products?.map((product) => {
              const expiry = getExpiryStatus(product);
              const isExpired = expiry === "expired";
              const nearExpiryDisc = Number(product.discount_percentage) || 0;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={isExpired}
                  className={`p-4 rounded-lg border text-left transition-all ${isExpired ? "opacity-50 cursor-not-allowed bg-muted" : "bg-card hover:border-primary/50 hover:shadow-sm"}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-medium text-sm truncate flex-1">
                      {product.name}
                    </p>
                    {getExpiryBadge(product)}
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-lg font-semibold text-success">
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
                  <p className="text-xs text-muted-foreground mt-1">
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
            {products?.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                No products found
              </p>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="lg:col-span-2">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Cart ({cart.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Cart is empty
                </p>
              ) : (
                <>
                  <div className="space-y-3 max-h-[25vh] overflow-auto">
                    {cart.map((item) => {
                      const nearExpiryDisc =
                        Number(item.product.discount_percentage) || 0;
                      const effectivePrice =
                        nearExpiryDisc > 0
                          ? Number(item.product.price) *
                            (1 - nearExpiryDisc / 100)
                          : Number(item.product.price);
                      return (
                        <div
                          key={item.product.id}
                          className="flex items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.product.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ₱{effectivePrice.toFixed(2)} × {item.quantity}
                              {nearExpiryDisc > 0 && (
                                <span className="text-warning ml-1">
                                  (-{nearExpiryDisc}%)
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() =>
                                updateQuantity(item.product.id, -1)
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm font-medium w-20 text-right">
                            ₱{(effectivePrice * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* PWD / Senior Discount Toggle */}
                  <div className="border-t pt-3">
                    <div className="flex gap-2 mb-3">
                      <Button
                        variant={discountType === "pwd" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() =>
                          setDiscountType(
                            discountType === "pwd" ? "none" : "pwd",
                          )
                        }
                      >
                        <UserCheck className="h-3 w-3 mr-1" /> PWD
                      </Button>
                      <Button
                        variant={
                          discountType === "senior" ? "default" : "outline"
                        }
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() =>
                          setDiscountType(
                            discountType === "senior" ? "none" : "senior",
                          )
                        }
                      >
                        <UserCheck className="h-3 w-3 mr-1" /> Senior
                      </Button>
                    </div>
                    {isDiscounted && (
                      <div className="mb-3 p-3 rounded-lg border bg-muted/30 space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          {discountType === "pwd" ? "PWD" : "Senior Citizen"} ID
                          Number *
                        </label>
                        <Input
                          value={customerIdNumber}
                          onChange={(e) => setCustomerIdNumber(e.target.value)}
                          placeholder="Enter ID number"
                          className="text-sm"
                        />
                      </div>
                    )}

                    {/* Price breakdown */}
                    {isDiscounted ? (
                      <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Original Price (VAT-incl.)</span>
                          <span>₱{cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>VAT Removed (12%)</span>
                          <span className="text-destructive">
                            -₱{(cartSubtotal - vatExemptSubtotal).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>VAT-Exempt Price</span>
                          <span>₱{vatExemptSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>20% {discountType.toUpperCase()} Discount</span>
                          <span className="text-destructive">
                            -₱{pwdSeniorDiscount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Net (excl. VAT)</span>
                          <span>₱{netAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>VAT (12%)</span>
                          <span>₱{vatAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total</span>
                      <div className="text-right">
                        <span className="text-xl font-bold text-success">
                          ₱{cartTotal.toFixed(2)}
                        </span>
                        {isDiscounted && (
                          <p className="text-xs text-muted-foreground">
                            You save ₱{discountAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cash Calculator Toggle */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mb-3"
                      onClick={() => {
                        setShowCalc(!showCalc);
                        if (!showCalc) setCashTendered(0);
                      }}
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      {showCalc ? "Hide Calculator" : "Cash Calculator"}
                    </Button>

                    {showCalc && (
                      <div className="space-y-3 mb-3 p-3 rounded-lg border bg-muted/30">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">
                            Cash Tendered
                          </label>
                          <Input
                            type="number"
                            value={cashTendered || ""}
                            onChange={(e) =>
                              setCashTendered(Number(e.target.value))
                            }
                            placeholder="0.00"
                            className="text-lg font-semibold"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {QUICK_CASH.map((amount) => (
                            <Button
                              key={amount}
                              variant="outline"
                              size="sm"
                              className="text-xs h-8"
                              onClick={() =>
                                setCashTendered((prev) => prev + amount)
                              }
                            >
                              +₱{amount}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setCashTendered(Math.ceil(cartTotal))}
                        >
                          Exact Amount
                        </Button>
                        <div
                          className={`flex justify-between items-center p-2 rounded-md ${changeAmount >= 0 ? "bg-success/10" : "bg-destructive/10"}`}
                        >
                          <span className="text-sm font-medium">Change</span>
                          <span
                            className={`text-lg font-bold ${changeAmount >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            ₱
                            {changeAmount >= 0
                              ? changeAmount.toFixed(2)
                              : "0.00"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {showCalc ? (
                        <Button
                          className="h-12 col-span-1"
                          variant="outline"
                          onClick={handleCashCheckout}
                          disabled={
                            checkoutMutation.isPending ||
                            cashTendered < cartTotal
                          }
                        >
                          <Banknote className="h-4 w-4 mr-2" /> Pay Cash
                        </Button>
                      ) : (
                        <Button
                          className="h-12"
                          variant="outline"
                          onClick={() => {
                            setShowCalc(true);
                            setCashTendered(0);
                          }}
                          disabled={checkoutMutation.isPending}
                        >
                          <Banknote className="h-4 w-4 mr-2" /> Cash
                        </Button>
                      )}
                      <Button
                        className="h-12"
                        onClick={() => checkoutMutation.mutate("card")}
                        disabled={checkoutMutation.isPending}
                      >
                        <CreditCard className="h-4 w-4 mr-2" /> Card
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receipt Dialog */}
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
                  {new Date().toLocaleString()}
                </p>
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
                          {" "}
                          Near-expiry discount: -{nearExpiryDisc}%
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
                {lastTransaction.discountType && (
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
                <p className="text-center mt-2">
                  Paid via {lastTransaction.method}
                </p>
                <p className="text-center text-muted-foreground mt-2">
                  Thank you for shopping!
                </p>
              </div>
              <Button onClick={handlePrint} className="w-full mt-2">
                <Printer className="h-4 w-4 mr-2" /> Print Receipt
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

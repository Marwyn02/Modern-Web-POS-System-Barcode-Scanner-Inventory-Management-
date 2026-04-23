/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Banknote,
  Calculator,
  CreditCard,
  Minus,
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { Tables } from "@/integrations/supabase/types";

type DiscountType = "none" | "pwd" | "senior";

type Product = Tables<"products">;

interface CartItem {
  product: Product;
  quantity: number;
}
[];

const QUICK_CASH = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

interface CartBodyProps {
  cart: CartItem[];
  discountType: DiscountType;
  customerIdNumber: string;
  setCustomerIdNumber: (v: string) => void;
  setDiscountType: (v: DiscountType) => void;
  showCalc: boolean;
  setShowCalc: (v: boolean) => void;
  cashTendered: number;
  setCashTendered: React.Dispatch<React.SetStateAction<number>>;
  cartSubtotal: number;
  vatExemptSubtotal: number;
  pwdSeniorDiscount: number;
  cartTotal: number;
  vatAmount: number;
  netAmount: number;
  discountAmount: number;
  changeAmount: number;
  checkoutMutation: any;
  updateQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  handleCashCheckout: () => void;
}

function CartBody({
  cart,
  discountType,
  customerIdNumber,
  setCustomerIdNumber,
  setDiscountType,
  showCalc,
  setShowCalc,
  cashTendered,
  setCashTendered,
  cartSubtotal,
  vatExemptSubtotal,
  pwdSeniorDiscount,
  cartTotal,
  vatAmount,
  netAmount,
  discountAmount,
  changeAmount,
  checkoutMutation,
  updateQuantity,
  removeFromCart,
  handleCashCheckout,
}: CartBodyProps) {
  const isDiscounted = discountType !== "none";

  return (
    <>
      {cart.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Cart is empty — scan or tap a product
        </p>
      ) : (
        <>
          <div
            className="overflow-y-auto space-y-2 pr-0.5"
            style={{ maxHeight: "min(32vh, 260px)" }}
          >
            {cart.map((item) => {
              const nearExpiryDisc =
                Number(item.product.discount_percentage) || 0;
              const effectivePrice =
                nearExpiryDisc > 0
                  ? Number(item.product.price) * (1 - nearExpiryDisc / 100)
                  : Number(item.product.price);
              return (
                <div key={item.product.id} className="flex items-center gap-2">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-7 text-center text-sm font-medium">
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
                  <p className="text-sm font-medium w-16 text-right shrink-0">
                    ₱{(effectivePrice * item.quantity).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-3 mt-3 space-y-3">
            <div className="flex gap-2">
              <Button
                variant={discountType === "pwd" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() =>
                  setDiscountType(discountType === "pwd" ? "none" : "pwd")
                }
              >
                <UserCheck className="h-3 w-3 mr-1" /> PWD
              </Button>
              <Button
                variant={discountType === "senior" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() =>
                  setDiscountType(discountType === "senior" ? "none" : "senior")
                }
              >
                <UserCheck className="h-3 w-3 mr-1" /> Senior
              </Button>
            </div>

            {isDiscounted && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {discountType === "pwd" ? "PWD" : "Senior Citizen"} ID Number
                  *
                </label>
                <Input
                  value={customerIdNumber}
                  onChange={(e) => setCustomerIdNumber(e.target.value)}
                  placeholder="Enter ID number"
                  className="text-sm"
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-1">
              {isDiscounted ? (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Original Price</span>
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
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Net (excl. VAT)</span>
                    <span>₱{netAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>VAT (12%)</span>
                    <span>₱{vatAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between items-center">
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

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setShowCalc(!showCalc);
                if (!showCalc) setCashTendered(0);
              }}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {showCalc ? "Hide Calculator" : "Cash Calculator"}
            </Button>

            {showCalc && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Cash Tendered
                  </label>
                  <Input
                    type="number"
                    value={cashTendered || ""}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
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
                      onClick={() => setCashTendered((prev) => prev + amount)}
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
                    ₱{changeAmount >= 0 ? changeAmount.toFixed(2) : "0.00"}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {showCalc ? (
                <Button
                  className="h-12"
                  variant="outline"
                  onClick={handleCashCheckout}
                  disabled={
                    checkoutMutation.isPending || cashTendered < cartTotal
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
    </>
  );
}

export default CartBody;

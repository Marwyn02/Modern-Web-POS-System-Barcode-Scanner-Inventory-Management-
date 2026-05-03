/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/static-components */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  AlertTriangle,
  Tag,
  ChevronLeft,
  ChevronRight,
  PackageMinus,
  User,
  Wrench,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { subDays, differenceInDays, format } from "date-fns";

type SortKey = "name" | "price" | "stock_quantity";
type SortDir = "asc" | "desc";
type WithdrawalType = "OWNER_WITHDRAWAL" | "STAFF_WITHDRAWAL" | "DAMAGE";

const ITEMS_PER_PAGE = 20;

const WITHDRAWAL_TYPES: {
  value: WithdrawalType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: "OWNER_WITHDRAWAL",
    label: "Owner Use",
    description: "Owner taking items for personal use",
    icon: <User className="h-3.5 w-3.5" />,
    color: "text-blue-600",
  },
  {
    value: "STAFF_WITHDRAWAL",
    label: "Staff Use",
    description: "Staff taking items for store operations",
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: "text-amber-600",
  },
  {
    value: "DAMAGE",
    label: "Damaged / Lost",
    description: "Items damaged, broken, or lost",
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    color: "text-destructive",
  },
];

const getExpiryZone = (expiryDate: string | null) => {
  if (!expiryDate) return "none";
  const daysLeft = differenceInDays(new Date(expiryDate), new Date());
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "near_expiry";
  return "good";
};

// ── Withdraw Item Dialog (defined outside to prevent focus loss) ──────────────
interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  onSuccess: () => void;
}

function WithdrawItemDialog({
  open,
  onOpenChange,
  products,
  onSuccess,
}: WithdrawDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState<WithdrawalType>("OWNER_WITHDRAWAL");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const filteredProducts = (products || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const reset = () => {
    setSearch("");
    setSelectedProduct(null);
    setQuantity("");
    setType("OWNER_WITHDRAWAL");
    setNote("");
  };

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Select a product");
      const qty = parseInt(quantity);
      if (!qty || qty <= 0) throw new Error("Enter a valid quantity");
      if (qty > selectedProduct.stock_quantity)
        throw new Error(
          `Only ${selectedProduct.stock_quantity} units available`,
        );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const unitCost = Number(
        selectedProduct.cost_price || selectedProduct.price || 0,
      );
      const totalCost = unitCost * qty;

      // 1. Record the withdrawal
      const { error: wErr } = await supabase.from("item_withdrawals").insert({
        product_id: selectedProduct.id,
        quantity: qty,
        type,
        note: note.trim() || null,
        unit_cost: unitCost,
        total_cost: totalCost,
        performed_by: user?.id || null,
      });
      if (wErr) throw wErr;

      // 2. Deduct from stock
      const { error: sErr } = await supabase
        .from("products")
        .update({
          stock_quantity: selectedProduct.stock_quantity - qty,
        })
        .eq("id", selectedProduct.id);
      if (sErr) throw sErr;
    },
    onSuccess: () => {
      const typeLabel =
        WITHDRAWAL_TYPES.find((t) => t.value === type)?.label ?? type;
      toast.success(
        `${quantity} × ${selectedProduct?.name} withdrawn (${typeLabel})`,
      );
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-products"] });
      onSuccess();
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedType = WITHDRAWAL_TYPES.find((t) => t.value === type)!;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageMinus className="h-4 w-4" /> Withdraw Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 — Product */}
          <div className="space-y-2">
            <Label>Product *</Label>
            {selectedProduct ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedProduct.stock_quantity} in stock ·{" "}
                    {selectedProduct.unit || "piece"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setSelectedProduct(null);
                    setQuantity("");
                    setSearch("");
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search product..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-sm"
                    autoFocus
                  />
                </div>
                {search.length > 0 && (
                  <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No products found
                      </p>
                    ) : (
                      filteredProducts.slice(0, 20).map((p) => (
                        <button
                          key={p.id}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 border-b last:border-0 flex items-center justify-between"
                          onClick={() => {
                            setSelectedProduct(p);
                            setSearch("");
                          }}
                        >
                          <span className="font-medium truncate flex-1">
                            {p.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">
                            {p.stock_quantity} left
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2 — Type */}
          <div className="space-y-2">
            <Label>Withdrawal Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              {WITHDRAWAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    type === t.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className={`mb-1 ${t.color}`}>{t.icon}</div>
                  <p className="text-xs font-medium leading-tight">{t.label}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedType.description}
            </p>
          </div>

          {/* Step 3 — Quantity */}
          <div className="space-y-2">
            <Label>
              Quantity *
              {selectedProduct && (
                <span className="text-muted-foreground font-normal ml-1">
                  (max {selectedProduct.stock_quantity})
                </span>
              )}
            </Label>
            <Input
              type="number"
              min="1"
              max={selectedProduct?.stock_quantity}
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {/* Stock impact preview */}
            {selectedProduct && quantity && parseInt(quantity) > 0 && (
              <div
                className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-md ${
                  parseInt(quantity) > selectedProduct.stock_quantity
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted/40"
                }`}
              >
                <span className="text-muted-foreground">Stock after:</span>
                <span className="font-medium">
                  {parseInt(quantity) > selectedProduct.stock_quantity
                    ? "⚠ Exceeds stock"
                    : `${selectedProduct.stock_quantity} → ${selectedProduct.stock_quantity - parseInt(quantity)}`}
                </span>
              </div>
            )}
          </div>

          {/* Step 4 — Note */}
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder={
                type === "OWNER_WITHDRAWAL"
                  ? "e.g. Owner personal use"
                  : type === "STAFF_WITHDRAWAL"
                    ? "e.g. Store cleaning supplies"
                    : "e.g. Dropped and broken during stocking"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Cost preview */}
          {selectedProduct &&
            quantity &&
            parseInt(quantity) > 0 &&
            parseInt(quantity) <= selectedProduct.stock_quantity && (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Inventory loss (at cost):
                </span>
                <span className="font-semibold text-destructive">
                  ₱
                  {(
                    Number(
                      selectedProduct.cost_price || selectedProduct.price || 0,
                    ) * parseInt(quantity)
                  ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={
                !selectedProduct ||
                !quantity ||
                parseInt(quantity) <= 0 ||
                parseInt(quantity) > (selectedProduct?.stock_quantity || 0) ||
                withdrawMutation.isPending
              }
              onClick={() => withdrawMutation.mutate()}
            >
              <PackageMinus className="h-3.5 w-3.5 mr-1.5" />
              {withdrawMutation.isPending ? "Saving…" : "Confirm Withdrawal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Inventory Page ───────────────────────────────────────────────────────
export default function Inventory() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [discountDialog, setDiscountDialog] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [discountPercent, setDiscountPercent] = useState("");
  const [disposeDialog, setDisposeDialog] = useState<{
    id: string;
    name: string;
    qty: number;
  } | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const { canManageInventory, isAdmin } = useUserRole();

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, stockFilter, expiryFilter, sortKey, sortDir]);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    price: "",
    cost_price: "",
    stock_quantity: "",
    low_stock_threshold: "10",
    category_id: "",
    unit: "piece",
    expiry_date: "",
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["inventory-products", search, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("name");
      if (search)
        query = query.or(
          `name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`,
        );
      if (categoryFilter !== "all")
        query = query.eq("category_id", categoryFilter);
      const { data } = await query;
      return data || [];
    },
  });

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const { data: recentSales } = useQuery({
    queryKey: ["inventory-recent-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_items")
        .select("product_id, quantity")
        .gte("created_at", thirtyDaysAgo);
      const map: Record<string, number> = {};
      (data || []).forEach((item) => {
        map[item.product_id!] = (map[item.product_id!] || 0) + item.quantity;
      });
      return map;
    },
  });

  const getProductSales30d = (productId: string) =>
    recentSales?.[productId] || 0;

  const filteredProducts = (products || [])
    .filter((p) => {
      if (stockFilter === "in_stock")
        return p.stock_quantity > p.low_stock_threshold;
      if (stockFilter === "low_stock")
        return (
          p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold
        );
      if (stockFilter === "out_of_stock") return p.stock_quantity === 0;
      if (stockFilter === "slow_moving")
        return p.stock_quantity > 0 && getProductSales30d(p.id) < 5;
      return true;
    })
    .filter((p) => {
      if (expiryFilter === "all") return true;
      return getExpiryZone(p.expiry_date) === expiryFilter;
    })
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        typeof aVal === "string"
          ? aVal.localeCompare(bVal as string)
          : Number(aVal) - Number(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      sku: "",
      barcode: "",
      price: "",
      cost_price: "",
      stock_quantity: "",
      low_stock_threshold: "10",
      category_id: "",
      unit: "piece",
      expiry_date: "",
    });
    setEditingProduct(null);
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      sku: product.sku || "",
      barcode: product.barcode || "",
      price: String(product.price),
      cost_price: String(product.cost_price || ""),
      stock_quantity: String(product.stock_quantity),
      low_stock_threshold: String(product.low_stock_threshold),
      category_id: product.category_id || "",
      unit: product.unit || "piece",
      expiry_date: product.expiry_date || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        price: parseFloat(form.price),
        cost_price: parseFloat(form.cost_price) || 0,
        stock_quantity: parseInt(form.stock_quantity),
        low_stock_threshold: parseInt(form.low_stock_threshold),
        category_id: form.category_id || null,
        unit: form.unit,
        expiry_date: form.expiry_date || null,
      };
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingProduct ? "Product updated" : "Product added");
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product removed");
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      setDeleteProductId(null);
    },
  });

  const setDiscountMutation = useMutation({
    mutationFn: async ({ id, percent }: { id: string; percent: number }) => {
      const { error } = await supabase
        .from("products")
        .update({
          discount_percentage: percent,
          discount_reason: percent > 0 ? "near_expiry" : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discount updated");
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-products"] });
      setDiscountDialog(null);
      setDiscountPercent("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disposeMutation = useMutation({
    mutationFn: async ({
      id,
      qty,
      costPrice,
    }: {
      id: string;
      qty: number;
      costPrice: number;
    }) => {
      const { error: dispErr } = await supabase.from("disposed_items").insert({
        product_id: id,
        quantity: qty,
        reason: "expired",
        unit_cost: costPrice,
        total_loss: costPrice * qty,
      });
      if (dispErr) throw dispErr;
      const { data: product } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", id)
        .single();
      if (product) {
        await supabase
          .from("products")
          .update({
            stock_quantity: Math.max(0, product.stock_quantity - qty),
          })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success("Expired items disposed and recorded as loss");
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      setDisposeDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getExpiryBadge = (expiryDate: string | null) => {
    const zone = getExpiryZone(expiryDate);
    if (zone === "expired") return <Badge variant="destructive">Expired</Badge>;
    if (zone === "critical")
      return (
        <Badge className="bg-destructive/80 text-destructive-foreground">
          Critical ≤7d
        </Badge>
      );
    if (zone === "near_expiry")
      return (
        <Badge className="bg-warning text-warning-foreground">
          Near Expiry
        </Badge>
      );
    if (zone === "good")
      return <Badge className="bg-success/20 text-success">Good</Badge>;
    return <span className="text-muted-foreground text-xs">—</span>;
  };

  const getStockBadge = (qty: number, threshold: number, productId: string) => {
    if (qty === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (qty <= threshold)
      return (
        <Badge className="bg-warning text-warning-foreground">Low Stock</Badge>
      );
    if (getProductSales30d(productId) < 5)
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Slow Moving
        </Badge>
      );
    return (
      <Badge className="bg-success text-success-foreground">In Stock</Badge>
    );
  };

  const SortableHead = ({ label, col }: { label: string; col: SortKey }) => (
    <TableHead
      className={
        col === "price" || col === "stock_quantity" ? "text-right" : ""
      }
    >
      <button
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => toggleSort(col)}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            {filteredProducts.length} products
            {totalPages > 1 && ` — page ${currentPage} of ${totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Withdraw Item button — available to all authenticated users */}
          <Button
            variant="outline"
            onClick={() => setWithdrawOpen(true)}
            className="border-amber-500/30 text-amber-600 hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-950/20"
          >
            <PackageMinus className="h-4 w-4 mr-2" /> Withdraw Item
          </Button>

          {canManageInventory && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="hover:bg-slate-900 hover:text-white hover:border-white">
                  <Plus className="h-4 w-4 mr-2" /> Add Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Edit Product" : "Add Product"}
                  </DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SKU</Label>
                      <Input
                        value={form.sku}
                        onChange={(e) =>
                          setForm({ ...form, sku: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Barcode</Label>
                      <Input
                        value={form.barcode}
                        onChange={(e) =>
                          setForm({ ...form, barcode: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.price}
                        onChange={(e) =>
                          setForm({ ...form, price: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.cost_price}
                        onChange={(e) =>
                          setForm({ ...form, cost_price: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stock Qty *</Label>
                      <Input
                        type="number"
                        value={form.stock_quantity}
                        onChange={(e) =>
                          setForm({ ...form, stock_quantity: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Low Stock Alert</Label>
                      <Input
                        type="number"
                        value={form.low_stock_threshold}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            low_stock_threshold: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input
                        type="date"
                        value={form.expiry_date}
                        onChange={(e) =>
                          setForm({ ...form, expiry_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={form.category_id}
                        onValueChange={(v) =>
                          setForm({ ...form, category_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Select
                        value={form.unit}
                        onValueChange={(v) => setForm({ ...form, unit: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="piece">Piece</SelectItem>
                          <SelectItem value="kg">Kilogram</SelectItem>
                          <SelectItem value="liter">Liter</SelectItem>
                          <SelectItem value="pack">Pack</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full hover:bg-amber-50 hover:text-amber-600 hover:border-amber-600"
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending
                      ? "Saving..."
                      : editingProduct
                        ? "Update Product"
                        : "Add Product"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
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
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            <SelectItem value="slow_moving">Slow Moving</SelectItem>
          </SelectContent>
        </Select>
        <Select value={expiryFilter} onValueChange={setExpiryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Expiry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expiry</SelectItem>
            <SelectItem value="good">Good (30d+)</SelectItem>
            <SelectItem value="near_expiry">Near Expiry (7-30d)</SelectItem>
            <SelectItem value="critical">Critical (≤7d)</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Product" col="name" />
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <SortableHead label="Price" col="price" />
                <SortableHead label="Stock" col="stock_quantity" />
                <TableHead>30d Sales</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                {canManageInventory && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.map((product) => {
                const zone = getExpiryZone(product.expiry_date);
                const disc = Number(product.discount_percentage) || 0;
                return (
                  <TableRow
                    key={product.id}
                    className={
                      zone === "expired"
                        ? "bg-destructive/5"
                        : zone === "critical"
                          ? "bg-warning/5"
                          : ""
                    }
                  >
                    <TableCell className="font-medium">
                      {product.name}
                      {disc > 0 && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          <Tag className="h-2 w-2 mr-1" />
                          {disc}% off
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.sku || "—"}
                    </TableCell>
                    <TableCell>
                      {(product.categories as any)?.name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      ₱{Number(product.price).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.stock_quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {getProductSales30d(product.id)}
                    </TableCell>
                    <TableCell>
                      {getExpiryBadge(product.expiry_date)}
                      {product.expiry_date && (
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(product.expiry_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStockBadge(
                        product.stock_quantity,
                        product.low_stock_threshold,
                        product.id,
                      )}
                    </TableCell>
                    {canManageInventory && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(zone === "near_expiry" || zone === "critical") &&
                            isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-warning"
                                title="Set Discount"
                                onClick={() => {
                                  setDiscountDialog({
                                    id: product.id,
                                    name: product.name,
                                  });
                                  setDiscountPercent(String(disc || ""));
                                }}
                              >
                                <Tag className="h-3 w-3" />
                              </Button>
                            )}
                          {zone === "expired" && isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              title="Dispose"
                              onClick={() =>
                                setDisposeDialog({
                                  id: product.id,
                                  name: product.name,
                                  qty: product.stock_quantity,
                                })
                              }
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(product)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteProductId(product.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canManageInventory ? 9 : 8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of{" "}
            {filteredProducts.length} products
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
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
                    key={`ellipsis-${i}`}
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
              )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Withdraw Item Dialog */}
      <WithdrawItemDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        products={products || []}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["inventory-products"] })
        }
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteProductId}
        onOpenChange={(open) => {
          if (!open) setDeleteProductId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this product from inventory? This
              will deactivate the product and it will no longer appear in sales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteProductId && deleteMutation.mutate(deleteProductId)
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set Near-Expiry Discount Dialog */}
      <Dialog
        open={!!discountDialog}
        onOpenChange={(open) => {
          if (!open) setDiscountDialog(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Near-Expiry Discount</DialogTitle>
          </DialogHeader>
          {discountDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set a discount for <strong>{discountDialog.name}</strong> to
                help clear near-expiry stock.
              </p>
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="90"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() =>
                    setDiscountMutation.mutate({
                      id: discountDialog.id,
                      percent: parseInt(discountPercent) || 0,
                    })
                  }
                  disabled={setDiscountMutation.isPending}
                >
                  {setDiscountMutation.isPending
                    ? "Saving..."
                    : "Apply Discount"}
                </Button>
                {Number(discountPercent) > 0 && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDiscountMutation.mutate({
                        id: discountDialog.id,
                        percent: 0,
                      })
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dispose Expired Items Dialog */}
      <AlertDialog
        open={!!disposeDialog}
        onOpenChange={(open) => {
          if (!open) setDisposeDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Dispose
              Expired Items
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{disposeDialog?.name}</strong> has expired. Disposing will
              remove <strong>{disposeDialog?.qty}</strong> units from inventory
              and record it as a loss in bookkeeping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!disposeDialog) return;
                const product = products?.find(
                  (p) => p.id === disposeDialog.id,
                );
                disposeMutation.mutate({
                  id: disposeDialog.id,
                  qty: disposeDialog.qty,
                  costPrice: Number(product?.cost_price || product?.price || 0),
                });
              }}
            >
              Dispose & Write Off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

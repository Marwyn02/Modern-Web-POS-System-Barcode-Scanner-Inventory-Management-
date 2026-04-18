/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/static-components */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { subDays, differenceInDays, format } from "date-fns";

type SortKey = "name" | "price" | "stock_quantity";
type SortDir = "asc" | "desc";

const getExpiryZone = (expiryDate: string | null) => {
  if (!expiryDate) return "none";
  const daysLeft = differenceInDays(new Date(expiryDate), new Date());
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "near_expiry";
  return "good";
};

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
  const queryClient = useQueryClient();
  const { canManageInventory, isAdmin } = useUserRole();

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
      // Record disposal
      const { error: dispErr } = await supabase.from("disposed_items").insert({
        product_id: id,
        quantity: qty,
        reason: "expired",
        unit_cost: costPrice,
        total_loss: costPrice * qty,
      });
      if (dispErr) throw dispErr;
      // Deduct stock
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            {filteredProducts.length} products
          </p>
        </div>
        {canManageInventory && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
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
                  className="w-full"
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
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
              {filteredProducts.map((product) => {
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

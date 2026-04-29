/* eslint-disable react-hooks/static-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Clock,
  Trash2,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

export default function Employees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const queryClient = useQueryClient();
  const { canManageEmployees, isAdmin } = useUserRole();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "cashier" as "cashier" | "admin" | "stock_clerk",
    hourly_rate: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: shiftHistory } = useQuery({
    queryKey: ["shift-history", selectedEmployee],
    enabled: !!selectedEmployee,
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", selectedEmployee!)
        .order("clock_in", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      role: "cashier",
      hourly_rate: "",
      password: "",
      confirmPassword: "",
    });
    setErrors({});
    setEditingEmployee(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const openEdit = (emp: any) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      email: emp.email || "",
      phone: emp.phone || "",
      role: emp.role,
      hourly_rate: String(emp.hourly_rate || ""),
      password: "",
      confirmPassword: "",
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Enter a valid email";

    if (!editingEmployee) {
      if (!form.password) newErrors.password = "Password is required";
      else if (form.password.length < 6)
        newErrors.password = "Password must be at least 6 characters";
      if (!form.confirmPassword)
        newErrors.confirmPassword = "Please confirm your password";
      else if (form.password !== form.confirmPassword)
        newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Validation failed");

      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role as "cashier" | "admin" | "stock_clerk",
        hourly_rate: parseFloat(form.hourly_rate) || 0,
      };

      if (editingEmployee) {
        // Edit mode — just update employees table, no auth changes
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editingEmployee.id);
        if (error) throw error;
      } else {
        // Create mode — signup via auth first, then insert to employees
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email: form.email.trim(),
            password: form.password,
            email_confirm: true,
          });

        // Fallback: use signUp if admin.createUser is not available
        let userId: string;
        if (authError) {
          // Try regular signUp as fallback
          const { data: signUpData, error: signUpError } =
            await supabase.auth.signUp({
              email: form.email.trim(),
              password: form.password,
            });
          if (signUpError) throw signUpError;
          if (!signUpData.user) throw new Error("Failed to create auth user");
          userId = signUpData.user.id;
        } else {
          if (!authData.user) throw new Error("Failed to create auth user");
          userId = authData.user.id;
        }

        const { error: empError } = await supabase.from("employees").insert({
          ...payload,
          user_id: userId,
        });
        if (empError) throw empError;
      }
    },
    onSuccess: () => {
      toast.success(
        editingEmployee ? "Employee updated" : "Employee account created",
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.message !== "Validation failed") toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee removed");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDeleteEmployeeId(null);
    },
  });

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-primary text-primary-foreground",
      cashier: "bg-success text-success-foreground",
      stock_clerk: "bg-warning text-warning-foreground",
    };
    return (
      <Badge className={colors[role] || ""}>{role.replace("_", " ")}</Badge>
    );
  };

  const PasswordInput = ({
    id,
    value,
    onChange,
    show,
    onToggle,
    placeholder,
    error,
  }: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggle: () => void;
    placeholder: string;
    error?: string;
  }) => (
    <div className="space-y-1">
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`pr-10 ${error ? "border-destructive" : ""}`}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            {employees?.length || 0} active employees
          </p>
        </div>

        {/* Only admins can open the create dialog */}
        {isAdmin && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {editingEmployee
                    ? "Edit Employee"
                    : "Create Employee Account"}
                </DialogTitle>
                {!editingEmployee && (
                  <p className="text-sm text-muted-foreground pt-1">
                    This will create a login account and add them to the
                    employee list.
                  </p>
                )}
              </DialogHeader>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
                className="space-y-5 pt-2"
              >
                {/* Personal Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> Personal Info
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Maria Santos"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className={errors.name ? "border-destructive" : ""}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="phone">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Phone
                        </span>
                      </Label>
                      <Input
                        id="phone"
                        placeholder="09xxxxxxxxx"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="hourly_rate">Hourly Rate (₱)</Label>
                      <Input
                        id="hourly_rate"
                        type="number"
                        step="0.01"
                        placeholder="Optional"
                        value={form.hourly_rate}
                        onChange={(e) =>
                          setForm({ ...form, hourly_rate: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="role">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Role *
                      </span>
                    </Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          role: v as "cashier" | "admin" | "stock_clerk",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="stock_clerk">Stock Clerk</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Account Credentials */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" /> Login Credentials
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Email *
                      </span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="employee@store.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      disabled={!!editingEmployee}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                    {editingEmployee && (
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed after account creation.
                      </p>
                    )}
                  </div>

                  {!editingEmployee && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="password">Password *</Label>
                        <PasswordInput
                          id="password"
                          value={form.password}
                          onChange={(v) => setForm({ ...form, password: v })}
                          show={showPassword}
                          onToggle={() => setShowPassword((s) => !s)}
                          placeholder="Min. 6 characters"
                          error={errors.password}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="confirmPassword">Confirm *</Label>
                        <PasswordInput
                          id="confirmPassword"
                          value={form.confirmPassword}
                          onChange={(v) =>
                            setForm({ ...form, confirmPassword: v })
                          }
                          show={showConfirmPassword}
                          onToggle={() => setShowConfirmPassword((s) => !s)}
                          placeholder="Re-enter password"
                          error={errors.confirmPassword}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={saveMutation.isPending}
                  size="lg"
                >
                  {saveMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                      {editingEmployee ? "Saving..." : "Creating account..."}
                    </span>
                  ) : editingEmployee ? (
                    "Save Changes"
                  ) : (
                    "Create Employee Account"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees?.map((emp) => {
                    return (
                      <TableRow
                        key={emp.id}
                        className={
                          selectedEmployee === emp.id ? "bg-muted" : ""
                        }
                        onClick={() => setSelectedEmployee(emp.id)}
                      >
                        <TableCell className="font-medium cursor-pointer">
                          {emp.name}
                        </TableCell>
                        <TableCell>{getRoleBadge(emp.role)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {emp.email || emp.phone || "—"}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canManageEmployees && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(emp);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteEmployeeId(emp.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Shift History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Shift History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEmployee ? (
              shiftHistory && shiftHistory.length > 0 ? (
                <div className="space-y-3">
                  {shiftHistory.map((shift) => (
                    <div
                      key={shift.id}
                      className="p-3 rounded-lg bg-muted text-sm"
                    >
                      <p className="font-medium">
                        {format(new Date(shift.clock_in), "MMM d, yyyy")}
                      </p>
                      <p className="text-muted-foreground">
                        {format(new Date(shift.clock_in), "h:mm a")}
                        {shift.clock_out
                          ? ` — ${format(new Date(shift.clock_out), "h:mm a")}`
                          : " — ongoing"}
                      </p>
                      {shift.clock_out && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {(
                            (new Date(shift.clock_out).getTime() -
                              new Date(shift.clock_in).getTime()) /
                            3600000
                          ).toFixed(1)}
                          h
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No shifts recorded
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Select an employee to view shifts
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteEmployeeId}
        onOpenChange={(open) => {
          if (!open) setDeleteEmployeeId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this employee? They will be
              deactivated and no longer appear in the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteEmployeeId && deleteMutation.mutate(deleteEmployeeId)
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

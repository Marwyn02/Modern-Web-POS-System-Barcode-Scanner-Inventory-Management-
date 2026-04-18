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
import { Plus, Pencil, Clock, LogIn, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

export default function Employees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { canManageEmployees } = useUserRole();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "cashier" as string,
    hourly_rate: "",
  });

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

  const { data: activeShifts } = useQuery({
    queryKey: ["active-shifts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .is("clock_out", null);
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
    });
    setEditingEmployee(null);
  };

  const openEdit = (emp: any) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      email: emp.email || "",
      phone: emp.phone || "",
      role: emp.role,
      hourly_rate: String(emp.hourly_rate || ""),
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role as "cashier" | "manager" | "stock_clerk",
        hourly_rate: parseFloat(form.hourly_rate) || 0,
      };
      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editingEmployee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingEmployee ? "Employee updated" : "Employee added");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => toast.error(error.message),
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

  const clockInMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("shifts")
        .insert({ employee_id: employeeId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clocked in");
      queryClient.invalidateQueries({ queryKey: ["active-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from("shifts")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clocked out");
      queryClient.invalidateQueries({ queryKey: ["active-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
    },
  });

  const getActiveShift = (employeeId: string) =>
    activeShifts?.find((s) => s.employee_id === employeeId);

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      manager: "bg-primary text-primary-foreground",
      cashier: "bg-success text-success-foreground",
      stock_clerk: "bg-warning text-warning-foreground",
    };
    return (
      <Badge className={colors[role] || ""}>{role.replace("_", " ")}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            {employees?.length || 0} active employees
          </p>
        </div>
        {canManageEmployees && (
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? "Edit Employee" : "Add Employee"}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm({ ...form, role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="stock_clerk">Stock Clerk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate (₱)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.hourly_rate}
                      onChange={(e) =>
                        setForm({ ...form, hourly_rate: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingEmployee
                      ? "Update"
                      : "Add Employee"}
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees?.map((emp) => {
                    const activeShift = getActiveShift(emp.id);
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
                        <TableCell>
                          {activeShift ? (
                            <Badge className="bg-success text-success-foreground">
                              On Shift
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Off</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {activeShift ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clockOutMutation.mutate(activeShift.id);
                                }}
                              >
                                <LogOut className="h-3 w-3 mr-1" /> Out
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clockInMutation.mutate(emp.id);
                                }}
                              >
                                <LogIn className="h-3 w-3 mr-1" /> In
                              </Button>
                            )}
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

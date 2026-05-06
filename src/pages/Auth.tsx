/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Register form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Check if employee is activated
      const { data: emp } = await supabase
        .from("employees")
        .select("is_activated")
        .eq("user_id", data.user.id)
        .single();

      if (emp && !emp.is_activated) {
        await supabase.auth.signOut();
        toast.error("Your account is pending admin approval.");
        return;
      }

      toast.success("Signed in successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return toast.error("Name is required");
    if (regPassword.length < 6)
      return toast.error("Password must be at least 6 characters");
    if (regPassword !== regConfirm)
      return toast.error("Passwords do not match");

    setRegLoading(true);
    try {
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: regEmail.trim(),
          password: regPassword,
        });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Failed to create account");

      // Sign out immediately before the app redirects
      await supabase.auth.signOut();

      // Insert employee row as inactive
      const { error: empError } = await supabase.from("employees").insert({
        user_id: signUpData.user.id,
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() || null,
        role: "cashier",
        is_active: true,
        is_activated: false,
      });
      if (empError) throw empError;

      // Insert user_roles row
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: signUpData.user.id,
        role: "cashier",
      });
      if (roleError) throw roleError;

      await supabase.auth.signOut();

      toast.success("Registration submitted! Wait for admin approval.");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegConfirm("");
      setRegPhone("");
    } catch (error: any) {
      console.log(error.message);

      toast.error(error.message);
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <ShoppingCart className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">GroceryPOS</h1>
          <p className="text-sm text-muted-foreground">
            Point of Sale Management System
          </p>
        </div>

        <Card className="shadow-md border-border/60">
          <CardHeader className="pb-4">
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="register" className="flex-1">
                  Request Access
                </TabsTrigger>
              </TabsList>

              {/* LOGIN */}
              <TabsContent value="login" className="mt-4">
                <CardTitle className="text-lg">Welcome back</CardTitle>
                <CardDescription className="mt-1">
                  Sign in with your store credentials
                </CardDescription>
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@store.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full mt-2"
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" /> Sign In
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* REGISTER */}
              <TabsContent value="register" className="mt-4">
                <CardTitle className="text-lg">Request Access</CardTitle>
                <CardDescription className="mt-1">
                  Submit your details for admin approval
                </CardDescription>
                <form onSubmit={handleRegister} className="space-y-3 mt-4">
                  <div className="space-y-1">
                    <Label>Full Name *</Label>
                    <Input
                      placeholder="e.g. Maria Santos"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="you@store.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input
                      placeholder="09xxxxxxxxx"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Password *</Label>
                      <div className="relative">
                        <Input
                          type={showRegPassword ? "text" : "password"}
                          placeholder="Min. 6 chars"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((v) => !v)}
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showRegPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Confirm *</Label>
                      <div className="relative">
                        <Input
                          type={showRegConfirm ? "text" : "password"}
                          placeholder="Re-enter"
                          value={regConfirm}
                          onChange={(e) => setRegConfirm(e.target.value)}
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirm((v) => !v)}
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showRegConfirm ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full mt-2"
                    disabled={regLoading}
                    size="lg"
                  >
                    {regLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" /> Request Access
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardHeader>
          <CardContent>
            <p className="text-center text-xs text-muted-foreground">
              Contact your administrator if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

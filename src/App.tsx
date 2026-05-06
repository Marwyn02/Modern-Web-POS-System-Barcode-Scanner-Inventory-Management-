import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { type Session } from "@supabase/supabase-js";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { syncPendingTransactions } from "@/db/syncPending";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Inventory from "./pages/Inventory";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import TransactionHistory from "./pages/TransactionHistory";
import Bookkeeping from "./pages/Bookkeeping";
import NotFound from "./pages/NotFound";
import ShiftReport from "./pages/ShiftReport";
import LogDetail from "./components/bookkeeping/LogDetail";
import Unauthorized from "./pages/Unauthorized";

const queryClient = new QueryClient();

// ── Inner component that uses hooks (must be inside QueryClientProvider) ─────
function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      // Track logout event for audit log
      if (_event === "SIGNED_OUT" && session === null) {
        // session is null here but we stored user before sign-out
        // The PendingAccess / AppSidebar sign out buttons call sessionNotify directly
        // so this is a fallback for unexpected sign-outs
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      console.log("[Sync] Back online — syncing pending transactions...");
      syncPendingTransactions();
    };

    window.addEventListener("online", handleOnline);

    // Also sync on mount in case there are pending ones from a previous session
    if (navigator.onLine) syncPendingTransactions();

    return () => window.removeEventListener("online", handleOnline);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  return <AuthenticatedApp />;
}

// ── Separate component so useSessionAccess only runs when authenticated ───────
function AuthenticatedApp() {
  // Admin OR active cashier — render full app
  return (
    <AppLayout>
      <Routes>
        {/* Admin only */}
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRole="admin">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute requiredRole="cashier">
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredRole="admin">
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookkeeping"
          element={
            <ProtectedRoute requiredRole="admin">
              <Bookkeeping />
            </ProtectedRoute>
          }
        />

        {/* Store clerk and above */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute requiredRole="store_clerk">
              <Inventory />
            </ProtectedRoute>
          }
        />

        {/* Cashier and above */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute requiredRole="cashier">
              <Sales />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute requiredRole="cashier">
              <TransactionHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shift-report/:shiftId"
          element={
            <ProtectedRoute requiredRole="cashier">
              <ShiftReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <LogDetail />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

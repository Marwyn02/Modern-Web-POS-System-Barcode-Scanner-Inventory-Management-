import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "cashier" | "store_clerk";

const ROLE_HIERARCHY: Record<AppRole, number> = {
  cashier: 1,
  store_clerk: 2,
  admin: 3,
};

export function useUserRole() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  // undefined = still resolving, null = no user, string = authenticated

  useEffect(() => {
    // Get initial session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    // Keep in sync on login/logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, session) => {
        setUserId(session?.user?.id ?? null);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      return (data || []).map((r) => r.role as AppRole);
    },
    enabled: userId !== undefined && userId !== null, // don't run until auth resolves
    staleTime: 1000 * 60 * 5, // cache for 5 min — role rarely changes
    gcTime: 1000 * 60 * 10,
  });

  // Still figuring out auth state OR fetching roles
  const isLoading = userId === undefined || rolesLoading;

  const hasRole = (role: AppRole): boolean => roles?.includes(role) ?? false;

  const hasMinRole = (minRole: AppRole): boolean => {
    if (!roles || roles.length === 0) return false;
    const userMax = Math.max(...roles.map((r) => ROLE_HIERARCHY[r] ?? 0));
    return userMax >= ROLE_HIERARCHY[minRole];
  };

  const isAdmin = hasRole("admin");
  const isCashier = hasRole("cashier");
  const isStoreClerk = hasRole("store_clerk");
  const isGuest = !isLoading && roles?.length === 0;

  // Access permissions
  const canAccessDashboard = isAdmin || isCashier || isStoreClerk;
  const canAccessSales = isAdmin || isCashier || isStoreClerk;
  const canAccessInventory = isAdmin || isStoreClerk;
  const canAccessEmployees = isAdmin || isCashier || isStoreClerk;
  const canAccessReports = isAdmin;
  const canAccessBookkeeping = isAdmin;
  const canManageEmployees = isAdmin;
  const canManageInventory = isAdmin || isStoreClerk;

  return {
    roles: roles || [],
    isLoading,
    isGuest,
    isAdmin,
    isCashier,
    isStoreClerk,
    hasRole,
    hasMinRole, // e.g. hasMinRole("store_clerk") = store_clerk OR admin
    canAccessDashboard,
    canAccessSales,
    canAccessInventory,
    canAccessEmployees,
    canAccessReports,
    canAccessBookkeeping,
    canManageEmployees,
    canManageInventory,
  };
}

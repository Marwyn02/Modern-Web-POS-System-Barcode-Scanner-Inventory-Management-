/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/useSessionAccess.ts
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export type SessionAccessStatus =
  | "loading"
  | "pending"
  | "active"
  | "revoked"
  | "admin";

export function useSessionAccess() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [status, setStatus] = useState<SessionAccessStatus>("loading");
  const [accessRecord, setAccessRecord] = useState<any>(null);

  useEffect(() => {
    if (roleLoading) return;

    // Admins bypass session access entirely
    if (isAdmin) {
      setStatus("admin");
      return;
    }

    let subscription: any;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("revoked");
        return;
      }

      // Upsert a session_access record when cashier logs in
      await supabase.from("session_access").upsert(
        {
          user_id: user.id,
          email: user.email!,
          requested_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: false },
      );

      // Fetch current status
      const { data } = await supabase
        .from("session_access")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setAccessRecord(data);
      setStatus(data?.is_active ? "active" : "pending");

      // Subscribe to realtime changes on this row
      subscription = supabase
        .channel(`session_access:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "session_access",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const updated = payload.new as any;
            setAccessRecord(updated);

            if (updated.is_active) {
              setStatus("active");
            } else {
              // Access was revoked — force sign out
              setStatus("revoked");
              await supabase.auth.signOut();
            }
          },
        )
        .subscribe();
    };

    init();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [isAdmin, roleLoading]);

  return { status, accessRecord };
}

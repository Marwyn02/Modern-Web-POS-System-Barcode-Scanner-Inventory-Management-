/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

export interface ResolvedEmployee {
  userId: string;
  employeeId: string;
  employeeName: string;
}

export async function resolveEmployee(): Promise<ResolvedEmployee> {
  // Get current auth user first — this is fast, uses local storage
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;

  // Check Dexie cache — only use it if it matches current user
  const cachedSession = await db.last_session.get("current");
  if (cachedSession && cachedSession.user_id === currentUserId) {
    // Refresh in background if online
    if (navigator.onLine) {
      (async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          const { data: employee } = await supabase
            .from("employees")
            .select("id, name")
            .eq("user_id", user.id)
            .single();
          if (!employee) return;
          await db.last_session.put({
            key: "current",
            user_id: user.id,
            employee_id: employee.id,
            name: employee.name,
            saved_at: new Date().toISOString(),
          });
        } catch (e) {
          /* silent */
        }
      })();
    }

    return {
      userId: cachedSession.user_id,
      employeeId: cachedSession.employee_id,
      employeeName: cachedSession.name,
    };
  }

  // No cache or different user — fetch from Supabase
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated. Please log in.");

  const { data: employee } = await supabase
    .from("employees")
    .select("id, name")
    .eq("user_id", user.id)
    .single();
  if (!employee) throw new Error("Employee record not found.");

  const resolved: ResolvedEmployee = {
    userId: user.id,
    employeeId: employee.id,
    employeeName: employee.name,
  };

  await db.last_session.put({
    key: "current",
    user_id: resolved.userId,
    employee_id: resolved.employeeId,
    name: resolved.employeeName,
    saved_at: new Date().toISOString(),
  });

  return resolved;
}

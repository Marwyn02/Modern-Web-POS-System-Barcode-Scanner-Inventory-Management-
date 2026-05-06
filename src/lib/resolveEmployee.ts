import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

export interface ResolvedEmployee {
  userId: string;
  employeeId: string;
  employeeName: string;
}

export async function resolveEmployee(): Promise<ResolvedEmployee> {
  // ── ONLINE PATH — Supabase is source of truth ──────────────────────────
  if (navigator.onLine) {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!authError && user) {
        const { data: employee } = await supabase
          .from("employees")
          .select("id, name")
          .eq("user_id", user.id)
          .single();

        if (employee) {
          const resolved: ResolvedEmployee = {
            userId: user.id, // auth UUID
            employeeId: employee.id, // employees PK
            employeeName: employee.name,
          };

          // ✅ Persist last session — survives offline indefinitely
          await db.last_session.put({
            key: "current",
            user_id: resolved.userId,
            employee_id: resolved.employeeId,
            name: resolved.employeeName,
            saved_at: new Date().toISOString(),
          });

          // ✅ Keep employees table warm for other lookups
          await db.employees.put({
            id: employee.id,
            user_id: user.id,
            name: employee.name,
            _sync_status: "synced",
          });

          return resolved;
        }
      }
    } catch (err) {
      console.warn(
        "[resolveEmployee] Supabase failed, falling back to Dexie:",
        err,
      );
    }
  }

  // ── OFFLINE PATH — read from Dexie ─────────────────────────────────────

  const session = await db.last_session.get("current");
  if (session) {
    return {
      userId: session.user_id,
      employeeId: session.employee_id,
      employeeName: session.name,
    };
  }

  throw new Error(
    "No cached session found. Please log in while online at least once before going offline.",
  );
}

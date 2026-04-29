// utils/sessionNotify.ts
import { supabase } from "@/integrations/supabase/client";

type NotifyType =
  | "login_request"
  | "access_granted"
  | "access_revoked"
  | "logout";

export async function sessionNotify(
  type: NotifyType,
  user: { id: string; email: string; name?: string },
) {
  try {
    await supabase.functions.invoke("session-notify", {
      body: {
        type,
        userId: user.id,
        email: user.email,
        name: user.name,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Non-critical — don't throw, just log
    console.warn("session-notify failed:", err);
  }
}

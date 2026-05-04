/**
 * shiftSync.ts
 * Syncs pending LocalShift and LocalCashboxLog records to Supabase.
 * Call syncPendingShifts() whenever the app detects it's back online.
 */

import { supabase } from "@/integrations/supabase/client";
import { db, type LocalShift, type LocalCashboxLog } from "@/lib/db";

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripMeta<
  T extends { _sync_status: string; _sync_error?: string | null },
>(record: T): Omit<T, "_sync_status" | "_sync_error"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _sync_status, _sync_error, ...rest } = record;
  return rest;
}

// ── Sync shifts ────────────────────────────────────────────────────────────────

async function syncShift(shift: LocalShift): Promise<void> {
  const payload = stripMeta(shift);

  const { error } = await supabase.from("shifts").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    await db.shifts.update(shift.id, {
      _sync_status: "error",
      _sync_error: error.message,
    });
    console.error("[ShiftSync] shift upsert failed:", error.message);
  } else {
    await db.shifts.update(shift.id, {
      _sync_status: "synced",
      _sync_error: null,
    });
  }
}

// ── Sync cashbox logs ──────────────────────────────────────────────────────────

async function syncCashboxLog(log: LocalCashboxLog): Promise<void> {
  const payload = stripMeta(log);

  const { error } = await supabase.from("cashbox_logs").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    await db.cashbox_logs.update(log.id, {
      _sync_status: "error",
      _sync_error: error.message,
    });
    console.error("[ShiftSync] cashbox_log upsert failed:", error.message);
  } else {
    await db.cashbox_logs.update(log.id, {
      _sync_status: "synced",
      _sync_error: null,
    });
  }
}

// ── Main sync entry point ──────────────────────────────────────────────────────

/**
 * Pushes all pending (unsynced) shifts and cashbox logs to Supabase.
 * Safe to call multiple times — already-synced records are skipped.
 */
export async function syncPendingShifts(): Promise<{
  synced: number;
  failed: number;
}> {
  let synced = 0;
  let failed = 0;

  const pendingShifts = await db.shifts
    .where("_sync_status")
    .anyOf(["pending", "error"])
    .toArray();

  for (const shift of pendingShifts) {
    try {
      await syncShift(shift);
      synced++;
    } catch {
      failed++;
    }
  }

  const pendingLogs = await db.cashbox_logs
    .where("_sync_status")
    .anyOf(["pending", "error"])
    .toArray();

  for (const log of pendingLogs) {
    try {
      await syncCashboxLog(log);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// ── Seed from Supabase (initial load / cache refresh) ─────────────────────────

/**
 * Pulls the employee's recent shifts from Supabase and caches them in Dexie.
 * Run once on login or when coming back online.
 */
export async function seedShiftsFromRemote(employeeId: string): Promise<void> {
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("employee_id", employeeId)
    .order("clock_in", { ascending: false })
    .limit(20);

  if (error || !shifts) return;

  const records = shifts.map((s) => ({
    ...s,
    _sync_status: "synced" as const,
    _sync_error: null,
  }));

  await db.shifts.bulkPut(records);
}

export async function seedCashboxLogsFromRemote(
  employeeId: string,
  shiftId?: string,
): Promise<void> {
  let query = supabase
    .from("cashbox_logs")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (shiftId) query = query.eq("shift_id", shiftId);

  const { data: logs, error } = await query;
  if (error || !logs) return;

  const records = logs.map((l) => ({
    ...l,
    type: l.type as "cash_in" | "cash_out",
    _sync_status: "synced" as const,
    _sync_error: null,
  }));

  await db.cashbox_logs.bulkPut(records);
}

/**
 * Pulls recent completed cash transactions for the employee into Dexie.
 * Used by clockOut to compute expectedCash offline.
 */
export async function seedTransactionsFromRemote(
  userId: string,
  sinceIso: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, employee_id, payment_method, status, total_amount, created_at")
    .eq("employee_id", userId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (error || !data) return;

  await db.transactions.bulkPut(
    data.map((t) => ({
      ...t,
      employee_id: t.employee_id ?? "",
      _sync_status: "synced" as const,
      _sync_error: null,
    })),
  );
}

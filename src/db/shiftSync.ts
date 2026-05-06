/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * shiftSync.ts
 * Syncs pending LocalShift, LocalCashboxLog, and LocalTransaction records to Supabase.
 * Call syncPendingShifts() whenever the app detects it's back online.
 */

import { supabase } from "@/integrations/supabase/client";
import { db, type LocalShift, type LocalCashboxLog } from "@/lib/db";
import type { LocalTransaction } from "@/lib/db";

// ── Sync transactions ──────────────────────────────────────────────────────────

async function syncTransaction(tx: LocalTransaction): Promise<void> {
  const { _sync_status, _sync_error, ...payload } = tx;

  const { error } = await supabase
    .from("transactions")
    .upsert(payload as any, { onConflict: "id" });

  if (error) {
    await db.transactions.update(tx.id, {
      _sync_status: "error",
      _sync_error: error.message,
    });
    console.error("[ShiftSync] transaction upsert failed:", error.message);
    throw error;
  }

  // Sync transaction items
  const items = await db.transaction_items
    .where("transaction_id")
    .equals(tx.id)
    .toArray();

  for (const item of items) {
    const {
      _sync_status: _s,
      _sync_error: _e,
      product_name: _n,
      ...itemPayload
    } = item;

    const { error: itemError } = await supabase
      .from("transaction_items")
      .upsert(itemPayload, { onConflict: "id" });

    if (itemError) {
      console.error(
        "[ShiftSync] transaction_item upsert failed:",
        itemError.message,
      );
    }
  }

  // Sync product stock
  for (const item of items) {
    const localProduct = await db.products.get(item.product_id);
    if (localProduct?.stock_quantity !== undefined) {
      await supabase
        .from("products")
        .update({ stock_quantity: localProduct.stock_quantity })
        .eq("id", item.product_id);
    }
  }

  // Mark everything synced
  await db.transactions.update(tx.id, {
    _sync_status: "synced",
    _sync_error: null,
  });
  await db.transaction_items
    .where("transaction_id")
    .equals(tx.id)
    .modify({ _sync_status: "synced", _sync_error: null });
}

// ── Sync shifts ────────────────────────────────────────────────────────────────

async function syncShift(shift: LocalShift): Promise<void> {
  // ✅ Strip local-only fields — employee_name does not exist in Supabase shifts
  const {
    _sync_status: _s,
    _sync_error: _e,
    employee_name: _n,
    ...payload
  } = shift;

  const { error } = await supabase
    .from("shifts")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    await db.shifts.update(shift.id, {
      _sync_status: "error",
      _sync_error: error.message,
    });
    console.error("[ShiftSync] shift upsert failed:", error.message);
    throw error;
  }

  await db.shifts.update(shift.id, {
    _sync_status: "synced",
    _sync_error: null,
  });
}

// ── Sync cashbox logs ──────────────────────────────────────────────────────────

async function syncCashboxLog(log: LocalCashboxLog): Promise<void> {
  const { _sync_status: _s, _sync_error: _e, ...payload } = log;

  const { error } = await supabase
    .from("cashbox_logs")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    await db.cashbox_logs.update(log.id, {
      _sync_status: "error",
      _sync_error: error.message,
    });
    console.error("[ShiftSync] cashbox_log upsert failed:", error.message);
    throw error;
  }

  await db.cashbox_logs.update(log.id, {
    _sync_status: "synced",
    _sync_error: null,
  });
}

// ── Main sync entry point ──────────────────────────────────────────────────────

/**
 * Pushes all pending (unsynced) transactions, shifts, and cashbox logs to Supabase.
 * Safe to call multiple times — already-synced records are skipped.
 */
export async function syncPendingShifts(): Promise<{
  synced: number;
  failed: number;
}> {
  let synced = 0;
  let failed = 0;

  // ── 1. Sync transactions first (most important) ───────────────────────────
  const pendingTx = await db.transactions
    .where("_sync_status")
    .anyOf(["pending", "error"])
    .toArray();

  for (const tx of pendingTx) {
    try {
      await syncTransaction(tx);
      synced++;
    } catch {
      failed++;
    }
  }

  // ── 2. Sync shifts ────────────────────────────────────────────────────────
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

  // ── 3. Sync cashbox logs ──────────────────────────────────────────────────
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

export async function seedShiftsFromRemote(employeeId: string): Promise<void> {
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("*, employees(id, name)")
    .eq("employee_id", employeeId)
    .order("clock_in", { ascending: false })
    .limit(20);

  if (error || !shifts) return;

  await db.shifts.bulkPut(
    shifts.map((s) => ({
      id: s.id,
      employee_id: s.employee_id,
      employee_name: (s.employees as any)?.name ?? null,
      clock_in: s.clock_in,
      clock_out: s.clock_out ?? null,
      starting_cash: s.starting_cash ?? null,
      ending_cash: s.ending_cash ?? null,
      expected_cash: s.expected_cash ?? null,
      cash_difference: s.cash_difference ?? null,
      notes: s.notes ?? null,
      created_at: s.created_at,
      _sync_status: "synced" as const,
      _sync_error: null,
    })),
  );
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

  await db.cashbox_logs.bulkPut(
    logs.map((l) => ({
      ...l,
      type: l.type as "cash_in" | "cash_out",
      _sync_status: "synced" as const,
      _sync_error: null,
    })),
  );
}

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

export async function seedIfEmpty(employeeId: string): Promise<void> {
  const count = await db.shifts.where("employee_id").equals(employeeId).count();
  if (count === 0 && navigator.onLine) {
    await seedShiftsFromRemote(employeeId);
    await seedCashboxLogsFromRemote(employeeId);
  }
}

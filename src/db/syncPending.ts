/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/syncPending.ts
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export async function syncPendingTransactions() {
  const pending = await db.transactions
    .where("_sync_status")
    .anyOf(["pending", "error"])
    .toArray();

  if (pending.length === 0) return;

  console.log(`[Sync] Found ${pending.length} pending transactions`);

  for (const tx of pending) {
    try {
      const { _sync_status, _sync_error, ...payload } = tx;

      const { error: txError } = await supabase
        .from("transactions")
        .upsert(payload as any, { onConflict: "id" });
      if (txError) throw txError;

      // Sync its items
      const items = await db.transaction_items
        .where("transaction_id")
        .equals(tx.id)
        .toArray();

      const itemsPayload = items.map(
        ({ _sync_status, _sync_error, product_name, ...rest }) => rest,
      );

      if (itemsPayload.length > 0) {
        const { error: itemsError } = await supabase
          .from("transaction_items")
          .upsert(itemsPayload, { onConflict: "id" });
        if (itemsError) throw itemsError;
      }

      // Mark synced
      await db.transactions.update(tx.id, {
        _sync_status: "synced",
        _sync_error: null,
      });
      await db.transaction_items
        .where("transaction_id")
        .equals(tx.id)
        .modify({ _sync_status: "synced", _sync_error: null });

      console.log(`[Sync] Synced transaction ${tx.id}`);
    } catch (err: any) {
      await db.transactions.update(tx.id, {
        _sync_status: "error",
        _sync_error: err?.message ?? String(err),
      });
      console.warn(`[Sync] Failed to sync ${tx.id}:`, err);
    }
  }
}

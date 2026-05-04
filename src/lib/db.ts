import Dexie, { type Table } from "dexie";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SyncStatus = "synced" | "pending" | "error";

export interface LocalTransaction {
  id: string;
  created_at: string;
  payment_method: string;
  status: string;
  employee_id: string;
  total_amount: number;
  vat_amount?: number;
  discount_type?: string | null;
  discount_amount?: number | null;
  _sync_status: SyncStatus;
  _sync_error?: string | null;
}

export interface LocalTransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  product_name: string;
  quantity?: number;
  price?: number;
  _sync_status: SyncStatus;
  _sync_error?: string | null;
}

export interface LocalProduct {
  id: string;
  category_id?: string;
  is_active?: boolean;
  stock_quantity?: number;
  barcode?: string;
  sku?: string;
  name?: string;
  price?: number;
  _sync_status: SyncStatus;
  _sync_error?: string | null;
}

export interface LocalShift {
  id: string;
  employee_id: string;
  starting_cash: number | null;
  clock_in: string;
  clock_out: string | null;
  ending_cash: number | null;
  expected_cash: number | null;
  cash_difference: number | null;
  notes: string | null;
  created_at: string;
  _sync_status: SyncStatus;
  _sync_error?: string | null;
}

export interface LocalCashboxLog {
  id: string;
  employee_id: string;
  shift_id: string | null;
  type: "cash_in" | "cash_out";
  amount: number;
  reason: string;
  created_at: string;
  _sync_status: SyncStatus;
  _sync_error?: string | null;
}

// ── Database ───────────────────────────────────────────────────────────────────

class PosDatabase extends Dexie {
  transactions!: Table<LocalTransaction, string>;
  transaction_items!: Table<LocalTransactionItem, string>;
  products!: Table<LocalProduct, string>;
  shifts!: Table<LocalShift, string>;
  cashbox_logs!: Table<LocalCashboxLog, string>;

  constructor() {
    super("posDB");

    this.version(3).stores({
      transactions: "id, created_at, payment_method, status, employee_id",
      transaction_items: "id, transaction_id, product_id, product_name",
      products: "id, category_id, is_active, stock_quantity, barcode, sku",
      shifts: "id, employee_id, clock_in, clock_out, _sync_status",
      cashbox_logs: "id, employee_id, shift_id, type, created_at, _sync_status",
    });
  }
}

export const db = new PosDatabase();

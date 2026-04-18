// utils/exportTransactions.ts
import { supabase } from "@/integrations/supabase/client";

type ExportRange = "daily" | "monthly" | "yearly";

export async function exportTransactionsCSV(range: ExportRange, date: Date) {
  let from: string;
  let to: string;
  let filename: string;

  if (range === "daily") {
    from = date.toISOString().split("T")[0];
    to = from;
    filename = `transactions_${from}.csv`;
  } else if (range === "monthly") {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    from = `${y}-${m}-01`;
    to = `${y}-${m}-31`;
    filename = `transactions_${y}-${m}.csv`;
  } else {
    const y = date.getFullYear();
    from = `${y}-01-01`;
    to = `${y}-12-31`;
    filename = `transactions_${y}.csv`;
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No data for this period.");

  // Convert to CSV
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((v) => (v === null ? "" : `"${String(v).replace(/"/g, '""')}"`))
      .join(","),
  );
  const csv = [headers, ...rows].join("\n");

  // Trigger download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

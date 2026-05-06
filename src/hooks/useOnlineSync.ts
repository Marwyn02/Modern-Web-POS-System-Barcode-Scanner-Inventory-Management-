import { useEffect, useRef } from "react";
import { syncPendingShifts } from "@/db/shiftSync";
import { syncPendingTransactions } from "@/db/syncPending";
import { toast } from "sonner";

export function useOnlineSync() {
  const isSyncing = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      try {
        const { synced, failed } = await syncPendingShifts();
        await syncPendingTransactions();

        if (synced > 0)
          toast.success(
            `Back online — synced ${synced} pending record${synced > 1 ? "s" : ""}.`,
          );
        if (failed > 0)
          toast.error(
            `${failed} record${failed > 1 ? "s" : ""} failed to sync. Will retry next time.`,
          );
      } catch (err) {
        console.error("[useOnlineSync] sync failed:", err);
      } finally {
        isSyncing.current = false;
      }
    };

    if (navigator.onLine) handleOnline();

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);
}

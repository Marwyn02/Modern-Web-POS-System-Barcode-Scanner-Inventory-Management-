/**
 * useOnlineStatus.ts
 * Reactive hook that tracks navigator.onLine and fires a callback
 * whenever the app transitions from offline → online.
 */

import { useState, useEffect, useCallback } from "react";

export function useOnlineStatus(onReconnect?: () => void) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    onReconnect?.();
  }, [onReconnect]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}

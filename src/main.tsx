import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";

// Register service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // New version available — auto update silently
    updateSW(true);
  },
  onOfflineReady() {
    console.log("POS 2026 is ready for offline use");
  },
  onRegistered(swRegistration) {
    console.log("Service worker registered:", swRegistration);
  },
  onRegisterError(error) {
    console.error("Service worker registration failed:", error);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

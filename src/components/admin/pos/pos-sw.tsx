"use client";

import { useEffect } from "react";

/** Registers the POS service worker (offline shell + asset cache). */
export function PosServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

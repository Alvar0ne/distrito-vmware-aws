"use client";

import { useEffect } from "react";

export function SiteVisitTracker() {
  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    if (path.startsWith("/admin") || path.startsWith("/api")) return;

    const payload = JSON.stringify({ path });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/visit", new Blob([payload], { type: "application/json" }));
      return;
    }

    fetch("/api/analytics/visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload,
      keepalive: true
    }).catch(() => undefined);
  }, []);

  return null;
}

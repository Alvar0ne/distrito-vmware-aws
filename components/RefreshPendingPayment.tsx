"use client";

import { useEffect } from "react";

type RefreshPendingPaymentProps = {
  active: boolean;
};

const REFRESH_KEY = "distrito-miami-payment-refresh-count";

export function RefreshPendingPayment({ active }: RefreshPendingPaymentProps) {
  useEffect(() => {
    if (!active) {
      window.sessionStorage.removeItem(REFRESH_KEY);
      return;
    }

    const currentCount = Number(window.sessionStorage.getItem(REFRESH_KEY) ?? "0");
    if (currentCount >= 12) return;

    window.sessionStorage.setItem(REFRESH_KEY, String(currentCount + 1));
    const timeout = window.setTimeout(() => {
      window.location.reload();
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [active]);

  return null;
}

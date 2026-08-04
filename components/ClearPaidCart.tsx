"use client";

import { useEffect } from "react";
import { CART_STORAGE_KEY } from "@/lib/cart";

type ClearPaidCartProps = {
  active: boolean;
};

export function ClearPaidCart({ active }: ClearPaidCartProps) {
  useEffect(() => {
    if (!active) return;

    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(new Event("distrito-miami-cart-cleared"));
  }, [active]);

  return null;
}

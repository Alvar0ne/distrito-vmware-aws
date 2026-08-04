import type { CartLine } from "./pricing";

export const CART_STORAGE_KEY = "distrito-miami-cart";

export function normalizeCartLines(lines: CartLine[]) {
  return lines.filter(
    (line) =>
      typeof line.productId === "string" &&
      typeof line.size === "string" &&
      Number.isInteger(line.quantity) &&
      line.quantity > 0
  );
}


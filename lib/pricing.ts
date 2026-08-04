import type { Product } from "./products";

export const FREE_DISCOUNT_THRESHOLD = 100000;
export const DISCOUNT_RATE = 0.1;
export const SANTIAGO_REGION = "Metropolitana de Santiago";
export const SANTIAGO_SHIPPING_FEE = 3000;
export const SHIPPING_METHODS = {
  HOME: "home",
  STARKEN: "starken"
} as const;

export type ShippingMethod = (typeof SHIPPING_METHODS)[keyof typeof SHIPPING_METHODS];

export type CartLine = {
  productId: string;
  size: string;
  quantity: number;
};

export type AppliedPromotion = {
  code: string;
  type: "percent" | "fixed";
  value: number;
};

export function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

export function calculatePromotionDiscount(subtotal: number, promotion?: AppliedPromotion | null) {
  if (!promotion || subtotal <= 0) return 0;

  const discount =
    promotion.type === "percent"
      ? Math.round(subtotal * (promotion.value / 100))
      : promotion.value;

  return Math.min(Math.max(discount, 0), subtotal);
}

export function calculateCart(
  lines: CartLine[],
  products: Product[],
  promotion?: AppliedPromotion | null
) {
  const subtotal = lines.reduce((total, line) => {
    const product = products.find((item) => item.id === line.productId);
    return total + (product?.price ?? 0) * line.quantity;
  }, 0);

  const automaticDiscount =
    subtotal >= FREE_DISCOUNT_THRESHOLD ? Math.round(subtotal * DISCOUNT_RATE) : 0;
  const promotionDiscount = calculatePromotionDiscount(subtotal, promotion);
  const discount = Math.min(automaticDiscount + promotionDiscount, subtotal);
  const total = subtotal - discount;

  return {
    subtotal,
    automaticDiscount,
    promotionDiscount,
    discount,
    total
  };
}

export function calculateShipping(region: string, shippingMethod: ShippingMethod) {
  if (region === SANTIAGO_REGION && shippingMethod === SHIPPING_METHODS.HOME) {
    return SANTIAGO_SHIPPING_FEE;
  }

  return 0;
}

export function calculateCheckoutTotals(
  lines: CartLine[],
  products: Product[],
  region: string,
  shippingMethod: ShippingMethod,
  promotion?: AppliedPromotion | null
) {
  const cart = calculateCart(lines, products, promotion);
  const shipping = calculateShipping(region, shippingMethod);

  return {
    ...cart,
    shipping,
    total: cart.total + shipping
  };
}

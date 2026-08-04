import type { Product } from "./products";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isBeltProduct(product: Pick<Product, "name">) {
  return normalizeText(product.name).includes("cinturon");
}

export function shouldHideProductSizes(product: Pick<Product, "category" | "name">) {
  return product.category === "accesorios" && !isBeltProduct(product);
}

export function formatCartLineDetail(product: Pick<Product, "brand" | "category" | "name">, size: string, quantity: number) {
  const quantityLabel = `${quantity} unidad(es)`;
  return shouldHideProductSizes(product)
    ? `${product.brand} · ${quantityLabel}`
    : `${product.brand} · Talla ${size} · ${quantityLabel}`;
}

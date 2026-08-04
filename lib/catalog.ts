import importedProducts from "@/data/products.imported.json";
import type { Product, ProductCategory } from "./products";

const allowedCategories = new Set<ProductCategory>([
  "poleras",
  "polerones",
  "chaquetas",
  "accesorios",
  "conjuntos"
]);

export const catalogProducts: Product[] = importedProducts.map((product) => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  category: allowedCategories.has(product.category as ProductCategory)
    ? (product.category as ProductCategory)
    : "accesorios",
  price: product.price,
  compareAtPrice: product.compareAtPrice ?? undefined,
  images: product.images,
  sizes: product.sizes,
  stockBySize: Object.fromEntries(
    Object.entries(product.stockBySize).map(([size, stock]) => [size, Number(stock ?? 0)])
  ),
  featured: product.featured,
  description: product.description
}));

export function getProductById(id: string) {
  return catalogProducts.find((product) => product.id === id);
}

export function getRelatedProducts(product: Product, limit = 4) {
  return catalogProducts
    .filter((item) => item.id !== product.id && item.category === product.category)
    .slice(0, limit);
}

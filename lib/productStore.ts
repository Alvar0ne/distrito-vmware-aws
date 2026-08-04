import { promises as fs } from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import { dbQuery, isPostgresEnabled, withTransaction } from "./db";
import type { Product, ProductCategory } from "./products";

export type StoredProduct = Product & {
  permalink?: string;
  metaTitle?: string;
  metaDescription?: string;
  categoriesRaw?: string;
  status?: string;
  sku?: string;
  stock?: number;
  weight?: number;
};

export type ProductPayload = {
  name: string;
  brand: string;
  category: ProductCategory;
  description: string;
  price: number;
  compareAtPrice?: number;
  featured: boolean;
  images: string[];
  sizes: string[];
  stockBySize: Record<string, number>;
};

const productsPath = path.join(process.cwd(), "data", "products.imported.json");
const allowedCategories = new Set<ProductCategory>([
  "poleras",
  "polerones",
  "chaquetas",
  "accesorios",
  "conjuntos"
]);

type ProductDatabaseRow = {
  id: string;
  permalink: string;
  name: string;
  description: string;
  meta_title: string | null;
  meta_description: string | null;
  brand: string | null;
  category_id: ProductCategory;
  status: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  featured: boolean;
  weight: number | null;
  images: string[];
  variants: Array<{ size: string; stock: number }>;
};

function normalizeProduct(product: StoredProduct): StoredProduct {
  const category = allowedCategories.has(product.category) ? product.category : "accesorios";
  const sizes = product.sizes?.length ? product.sizes : ["U"];
  const stockBySize = Object.fromEntries(
    sizes.map((size) => [size, Number(product.stockBySize?.[size] ?? 0)])
  );

  return {
    ...product,
    category,
    sizes,
    stockBySize,
    price: Number(product.price ?? 0),
    compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
    stock: Object.values(stockBySize).reduce((sum, stock) => sum + stock, 0)
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function buildStockBySize(payload: ProductPayload) {
  return Object.fromEntries(
    payload.sizes.map((size) => [size, Number(payload.stockBySize[size] ?? 0)])
  );
}

function mapDatabaseProduct(row: ProductDatabaseRow): StoredProduct {
  const variants = row.variants ?? [];
  const sizes = variants.length ? variants.map((variant) => variant.size) : ["U"];
  const stockBySize = Object.fromEntries(
    variants.length
      ? variants.map((variant) => [variant.size, Number(variant.stock)])
      : [["U", 0]]
  );

  return normalizeProduct({
    id: row.id,
    permalink: row.permalink,
    name: row.name,
    description: row.description,
    metaTitle: row.meta_title ?? undefined,
    metaDescription: row.meta_description ?? undefined,
    brand: row.brand ?? "",
    category: row.category_id,
    status: row.status ?? undefined,
    sku: row.sku ?? undefined,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null ? undefined : Number(row.compare_at_price),
    featured: row.featured,
    weight: row.weight === null ? undefined : Number(row.weight),
    images: row.images ?? [],
    sizes,
    stockBySize
  });
}

async function readPostgresProducts() {
  const result = await dbQuery<ProductDatabaseRow>(
    `
      select
        p.id, p.permalink, p.name, p.description, p.meta_title, p.meta_description,
        b.name as brand, p.category_id, p.status, p.sku, p.price,
        p.compare_at_price, p.featured, p.weight,
        coalesce(
          (select json_agg(pi.url order by pi.sort_order)
           from product_images pi where pi.product_id = p.id),
          '[]'::json
        ) as images,
        coalesce(
          (select json_agg(json_build_object('size', pv.size, 'stock', pv.stock) order by pv.created_at)
           from product_variants pv where pv.product_id = p.id),
          '[]'::json
        ) as variants
      from products p
      left join brands b on b.id = p.brand_id
      order by p.created_at desc, p.name asc
    `
  );

  return result.rows.map(mapDatabaseProduct);
}

async function upsertDatabaseBrand(client: PoolClient, name: string) {
  const brand = name.trim();
  if (!brand) return null;

  const result = await client.query<{ id: string }>(
    `
      insert into brands (name) values ($1)
      on conflict (name) do update set name = excluded.name
      returning id
    `,
    [brand]
  );

  return result.rows[0].id;
}

async function persistDatabaseProduct(
  client: PoolClient,
  id: string,
  payload: ProductPayload,
  create: boolean
) {
  const brandId = await upsertDatabaseBrand(client, payload.brand);

  if (create) {
    await client.query(
      `
        insert into products (
          id, permalink, name, description, meta_title, meta_description,
          brand_id, category_id, price, compare_at_price, featured, updated_at
        ) values ($1, $1, $2, $3, $2, $3, $4, $5, $6, $7, $8, now())
      `,
      [
        id,
        payload.name,
        payload.description,
        brandId,
        payload.category,
        payload.price,
        payload.compareAtPrice ?? null,
        payload.featured
      ]
    );
  } else {
    await client.query(
      `
        update products set
          name = $2, description = $3, meta_title = $2, meta_description = $3,
          brand_id = $4, category_id = $5, price = $6, compare_at_price = $7,
          featured = $8, updated_at = now()
        where id = $1
      `,
      [
        id,
        payload.name,
        payload.description,
        brandId,
        payload.category,
        payload.price,
        payload.compareAtPrice ?? null,
        payload.featured
      ]
    );
  }

  await client.query("delete from product_images where product_id = $1", [id]);
  for (const [index, image] of payload.images.entries()) {
    await client.query(
      "insert into product_images (product_id, url, sort_order) values ($1, $2, $3)",
      [id, image, index]
    );
  }

  await client.query("delete from product_variants where product_id = $1", [id]);
  for (const size of payload.sizes) {
    await client.query(
      "insert into product_variants (product_id, size, stock) values ($1, $2, $3)",
      [id, size, Number(payload.stockBySize[size] ?? 0)]
    );
  }
}

export async function readStoredProducts(): Promise<StoredProduct[]> {
  if (isPostgresEnabled()) {
    return readPostgresProducts();
  }

  const raw = await fs.readFile(productsPath, "utf8");
  return (JSON.parse(raw) as StoredProduct[]).map(normalizeProduct);
}

export async function readStoredProductById(id: string) {
  const products = await readStoredProducts();
  return products.find((product) => product.id === id);
}

export async function createStoredProduct(payload: ProductPayload) {
  const products = await readStoredProducts();
  const baseId = slugify(payload.name) || `producto-${Date.now()}`;
  const existingIds = new Set(products.map((product) => product.id));
  let id = baseId;
  let counter = 2;

  while (existingIds.has(id)) {
    id = `${baseId}-${counter}`;
    counter += 1;
  }

  if (isPostgresEnabled()) {
    await withTransaction((client) => persistDatabaseProduct(client, id, payload, true));
    return readStoredProductById(id) as Promise<StoredProduct>;
  }

  const stockBySize = buildStockBySize(payload);
  const stock = Object.values(stockBySize).reduce((sum, value) => sum + value, 0);
  const product: StoredProduct = normalizeProduct({
    ...payload,
    id,
    permalink: id,
    metaTitle: payload.name,
    metaDescription: payload.description,
    stock,
    stockBySize
  });

  products.unshift(product);
  await fs.writeFile(productsPath, JSON.stringify(products, null, 2), "utf8");
  return product;
}

export async function updateStoredProduct(id: string, update: ProductPayload) {
  const products = await readStoredProducts();
  const index = products.findIndex((product) => product.id === id);

  if (index < 0) {
    return null;
  }

  if (isPostgresEnabled()) {
    await withTransaction((client) => persistDatabaseProduct(client, id, update, false));
    return readStoredProductById(id);
  }

  const stockBySize = buildStockBySize(update);
  const stock = Object.values(stockBySize).reduce((sum, value) => sum + value, 0);
  const current = products[index];
  const updated: StoredProduct = normalizeProduct({
    ...current,
    ...update,
    compareAtPrice: update.compareAtPrice,
    metaTitle: update.name,
    metaDescription: update.description,
    stock,
    stockBySize
  });

  products[index] = updated;
  await fs.writeFile(productsPath, JSON.stringify(products, null, 2), "utf8");
  return updated;
}

export async function deleteStoredProduct(id: string) {
  if (isPostgresEnabled()) {
    const result = await dbQuery<{ id: string }>(
      "delete from products where id = $1 returning id",
      [id]
    );
    return Boolean(result.rowCount);
  }

  const products = await readStoredProducts();
  const nextProducts = products.filter((product) => product.id !== id);
  if (nextProducts.length === products.length) return false;

  await fs.writeFile(productsPath, JSON.stringify(nextProducts, null, 2), "utf8");
  return true;
}

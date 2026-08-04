import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import pg from "pg";

const { Client } = pg;

const root = process.cwd();
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL. Copy .env.example to .env.local or export DATABASE_URL.");
  process.exit(1);
}

const dataPath = path.join(root, "data", "products.imported.json");
const ordersPath = path.join(root, "data", "orders.local.json");
const schemaPath = path.join(root, "db", "schema.sql");

const products = JSON.parse(await fs.readFile(dataPath, "utf8"));
const orders = JSON.parse(await fs.readFile(ordersPath, "utf8"));
const schema = await fs.readFile(schemaPath, "utf8");

const client = new Client({ connectionString: databaseUrl });

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

async function upsertBrand(name) {
  const brand = normalizeText(name);
  if (!brand) return null;

  const result = await client.query(
    `
      insert into brands (name)
      values ($1)
      on conflict (name) do update set name = excluded.name
      returning id
    `,
    [brand]
  );

  return result.rows[0].id;
}

async function seedProduct(product) {
  const brandId = await upsertBrand(product.brand);

  await client.query(
    `
      insert into products (
        id, permalink, name, description, meta_title, meta_description,
        brand_id, category_id, status, sku, price, compare_at_price,
        featured, weight, updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
      on conflict (id) do update set
        permalink = excluded.permalink,
        name = excluded.name,
        description = excluded.description,
        meta_title = excluded.meta_title,
        meta_description = excluded.meta_description,
        brand_id = excluded.brand_id,
        category_id = excluded.category_id,
        status = excluded.status,
        sku = excluded.sku,
        price = excluded.price,
        compare_at_price = excluded.compare_at_price,
        featured = excluded.featured,
        weight = excluded.weight,
        updated_at = now()
    `,
    [
      product.id,
      product.permalink ?? product.id,
      product.name,
      product.description ?? "",
      normalizeText(product.metaTitle),
      normalizeText(product.metaDescription),
      brandId,
      product.category,
      product.status ?? "available",
      normalizeText(product.sku),
      product.price,
      product.compareAtPrice ?? null,
      Boolean(product.featured),
      product.weight ?? 1
    ]
  );

  await client.query("delete from product_images where product_id = $1", [product.id]);
  for (const [index, url] of (product.images ?? []).entries()) {
    await client.query(
      `
        insert into product_images (product_id, url, sort_order)
        values ($1, $2, $3)
      `,
      [product.id, url, index]
    );
  }

  const sizes = product.sizes?.length ? product.sizes : ["U"];

  for (const size of sizes) {
    const stock = product.stockBySize?.[size] ?? 0;
    await client.query(
      `
        insert into product_variants (product_id, size, stock, sku, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (product_id, size) do update set
          stock = excluded.stock,
          sku = excluded.sku,
          updated_at = now()
      `,
      [product.id, size, stock, normalizeText(product.sku)]
    );
  }

  await client.query(
    "delete from product_variants where product_id = $1 and not (size = any($2::text[]))",
    [product.id, sizes]
  );
}

async function seedOrder(order) {
  const orderDate = order.createdAt ?? new Date().toISOString();
  const customerResult = await client.query(
    `
      insert into customers (
        name, rut, email, phone, last_region, last_commune,
        last_shipping_address, first_order_at, last_order_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $8, now())
      on conflict (email) do update set
        name = excluded.name,
        rut = excluded.rut,
        phone = excluded.phone,
        last_region = excluded.last_region,
        last_commune = excluded.last_commune,
        last_shipping_address = excluded.last_shipping_address,
        first_order_at = least(customers.first_order_at, excluded.first_order_at),
        last_order_at = greatest(customers.last_order_at, excluded.last_order_at),
        updated_at = now()
      returning id
    `,
    [
      normalizeText(order.customer?.name) ?? "Cliente",
      normalizeText(order.customer?.rut),
      String(order.customer?.email ?? "").trim().toLowerCase(),
      normalizeText(order.customer?.phone),
      normalizeText(order.customer?.region),
      normalizeText(order.customer?.commune),
      normalizeText(order.customer?.shippingAddress),
      orderDate
    ]
  );
  const customerId = customerResult.rows[0].id;

  await client.query(
    `
      insert into orders (
        id, customer_id, customer_name, customer_rut, customer_email, customer_phone,
        shipping_region, shipping_commune, shipping_method, shipping_address, notes,
        subtotal, discount, shipping_total, total, payment_provider, payment_status,
        fulfillment_status, flow_token, flow_order_number, payment_url, inventory_deducted, promotion_code, created_at, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, false, $22, $23, now()
      )
      on conflict (id) do update set
        customer_id = excluded.customer_id,
        customer_name = excluded.customer_name,
        customer_rut = excluded.customer_rut,
        customer_email = excluded.customer_email,
        customer_phone = excluded.customer_phone,
        shipping_region = excluded.shipping_region,
        shipping_commune = excluded.shipping_commune,
        shipping_method = excluded.shipping_method,
        shipping_address = excluded.shipping_address,
        notes = excluded.notes,
        subtotal = excluded.subtotal,
        discount = excluded.discount,
        shipping_total = excluded.shipping_total,
        total = excluded.total,
        payment_provider = excluded.payment_provider,
        payment_status = excluded.payment_status,
        fulfillment_status = excluded.fulfillment_status,
        flow_token = excluded.flow_token,
        flow_order_number = excluded.flow_order_number,
        payment_url = excluded.payment_url,
        inventory_deducted = orders.inventory_deducted,
        promotion_code = excluded.promotion_code,
        updated_at = now()
    `,
    [
      order.id,
      customerId,
      normalizeText(order.customer?.name),
      normalizeText(order.customer?.rut),
      order.customer?.email,
      normalizeText(order.customer?.phone),
      normalizeText(order.customer?.region),
      normalizeText(order.customer?.commune),
      normalizeText(order.customer?.shippingMethod),
      normalizeText(order.customer?.shippingAddress),
      normalizeText(order.customer?.notes),
      order.totals?.subtotal ?? 0,
      order.totals?.discount ?? 0,
      order.totals?.shipping ?? 0,
      order.totals?.total ?? 0,
      order.payment?.provider ?? "flow",
      order.paymentStatus ?? "pending",
      order.fulfillmentStatus ?? "received",
      normalizeText(order.payment?.token),
      normalizeText(order.payment?.flowOrder),
      normalizeText(order.payment?.url),
      normalizeText(order.promotionCode),
      orderDate
    ]
  );

  await client.query("delete from order_items where order_id = $1", [order.id]);

  for (const item of order.items ?? []) {
    await client.query(
      `
        insert into order_items (
          order_id, product_id, variant_id, product_name, image_url, size,
          quantity, unit_price, line_total
        )
        values (
          $1, $2,
          (select id from product_variants where product_id = $2 and size = $5 limit 1),
          $3, $4, $5, $6, $7, $8
        )
      `,
      [
        order.id,
        item.productId,
        item.productName,
        item.imageUrl ?? "",
        item.size,
        item.quantity,
        item.unitPrice,
        item.lineTotal
      ]
    );
  }
}

await client.connect();

try {
  await client.query("begin");
  await client.query(schema);

  for (const product of products) {
    await seedProduct(product);
  }

  for (const order of orders) {
    await seedOrder(order);
  }

  await client.query("commit");
  console.log(`Migrated ${products.length} products and ${orders.length} orders into PostgreSQL.`);
} catch (error) {
  await client.query("rollback");
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}

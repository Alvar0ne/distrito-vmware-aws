import { promises as fs } from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();
const customersPath = path.join(process.cwd(), "data", "customers.local.json");

if (!databaseUrl || databaseUrl.includes("change-me")) {
  console.error("Falta DATABASE_URL valido.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

try {
  const raw = await fs.readFile(customersPath, "utf8");
  const customers = JSON.parse(raw);
  let inserted = 0;
  let skipped = 0;

  for (const customer of customers) {
    const email = normalizeEmail(customer.email);
    if (!email) {
      skipped += 1;
      continue;
    }

    const result = await pool.query(
      `
        insert into customers (
          name, rut, email, phone, last_region, last_commune,
          last_shipping_address, first_order_at, last_order_at,
          created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11
        )
        on conflict (email) do nothing
      `,
      [
        customer.name || "Cliente importado",
        customer.rut || null,
        email,
        customer.phone || null,
        customer.region || null,
        customer.commune || null,
        customer.shippingAddress || null,
        customer.firstOrderAt || new Date().toISOString(),
        customer.lastOrderAt || customer.firstOrderAt || new Date().toISOString(),
        customer.createdAt || new Date().toISOString(),
        customer.updatedAt || new Date().toISOString()
      ]
    );

    if (result.rowCount) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`clientes_insertados=${inserted}`);
  console.log(`clientes_existentes_o_invalidos=${skipped}`);
} finally {
  await pool.end();
}

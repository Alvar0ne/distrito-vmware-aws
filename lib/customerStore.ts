import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { dbQuery, isPostgresEnabled } from "./db";

export type CustomerInput = {
  name: string;
  rut: string;
  email: string;
  phone: string;
  region: string;
  commune: string;
  shippingAddress: string;
};

export type StoredCustomer = CustomerInput & {
  id: string;
  firstOrderAt: string;
  lastOrderAt: string;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
};

type CustomerDatabaseRow = {
  id: string;
  name: string;
  rut: string | null;
  email: string;
  phone: string | null;
  last_region: string | null;
  last_commune: string | null;
  last_shipping_address: string | null;
  first_order_at: Date | string;
  last_order_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  order_count: number | string;
};

const customersPath = path.join(process.cwd(), "data", "customers.local.json");
const ordersPath = path.join(process.cwd(), "data", "orders.local.json");

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapDatabaseCustomer(row: CustomerDatabaseRow): StoredCustomer {
  return {
    id: row.id,
    name: row.name,
    rut: row.rut ?? "",
    email: row.email,
    phone: row.phone ?? "",
    region: row.last_region ?? "",
    commune: row.last_commune ?? "",
    shippingAddress: row.last_shipping_address ?? "",
    firstOrderAt: new Date(row.first_order_at).toISOString(),
    lastOrderAt: new Date(row.last_order_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    orderCount: Number(row.order_count)
  };
}

async function ensureCustomersFile() {
  try {
    await fs.access(customersPath);
  } catch {
    await fs.mkdir(path.dirname(customersPath), { recursive: true });
    let customers: StoredCustomer[] = [];

    try {
      const rawOrders = await fs.readFile(ordersPath, "utf8");
      const orders = JSON.parse(rawOrders) as Array<{
        customer: CustomerInput;
        createdAt: string;
      }>;
      const customersByEmail = new Map<string, StoredCustomer>();

      for (const order of [...orders].reverse()) {
        const email = normalizeEmail(order.customer.email);
        const current = customersByEmail.get(email);
        const createdAt = order.createdAt ?? new Date().toISOString();

        if (current) {
          customersByEmail.set(email, {
            ...current,
            ...order.customer,
            email,
            lastOrderAt: createdAt,
            updatedAt: createdAt,
            orderCount: current.orderCount + 1
          });
        } else {
          customersByEmail.set(email, {
            id: randomUUID(),
            ...order.customer,
            email,
            firstOrderAt: createdAt,
            lastOrderAt: createdAt,
            createdAt,
            updatedAt: createdAt,
            orderCount: 1
          });
        }
      }

      customers = Array.from(customersByEmail.values()).sort(
        (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
      );
    } catch {
      customers = [];
    }

    await fs.writeFile(customersPath, JSON.stringify(customers, null, 2), "utf8");
  }
}

export async function readCustomers(): Promise<StoredCustomer[]> {
  if (isPostgresEnabled()) {
    const result = await dbQuery<CustomerDatabaseRow>(
      `
        select c.*, count(o.id) as order_count
        from customers c
        left join orders o on o.customer_id = c.id
        group by c.id
        order by c.last_order_at desc
      `
    );
    return result.rows.map(mapDatabaseCustomer);
  }

  await ensureCustomersFile();
  const raw = await fs.readFile(customersPath, "utf8");
  return JSON.parse(raw) as StoredCustomer[];
}

export async function upsertCustomer(input: CustomerInput) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();

  if (isPostgresEnabled()) {
    const result = await dbQuery<{ id: string }>(
      `
        insert into customers (
          name, rut, email, phone, last_region, last_commune,
          last_shipping_address, first_order_at, last_order_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, now(), now(), now())
        on conflict (email) do update set
          name = excluded.name,
          rut = excluded.rut,
          phone = excluded.phone,
          last_region = excluded.last_region,
          last_commune = excluded.last_commune,
          last_shipping_address = excluded.last_shipping_address,
          last_order_at = now(),
          updated_at = now()
        returning id
      `,
      [
        input.name,
        input.rut,
        email,
        input.phone,
        input.region,
        input.commune,
        input.shippingAddress
      ]
    );
    return result.rows[0].id;
  }

  const customers = await readCustomers();
  const index = customers.findIndex((customer) => customer.email === email);

  if (index >= 0) {
    const current = customers[index];
    customers[index] = {
      ...current,
      ...input,
      email,
      lastOrderAt: now,
      updatedAt: now,
      orderCount: current.orderCount + 1
    };
  } else {
    customers.unshift({
      id: randomUUID(),
      ...input,
      email,
      firstOrderAt: now,
      lastOrderAt: now,
      createdAt: now,
      updatedAt: now,
      orderCount: 1
    });
  }

  await fs.writeFile(customersPath, JSON.stringify(customers, null, 2), "utf8");
  return customers.find((customer) => customer.email === email)?.id ?? null;
}

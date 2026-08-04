import { promises as fs } from "node:fs";
import path from "node:path";
import { upsertCustomer } from "./customerStore";
import { dbQuery, isPostgresEnabled, withTransaction } from "./db";
import type { buildOrder } from "./orders";
import type { StoredOrder } from "./orderTypes";

type OrderDatabaseRow = {
  id: string;
  customer_name: string | null;
  customer_rut: string | null;
  customer_email: string;
  customer_phone: string | null;
  shipping_region: string | null;
  shipping_commune: string | null;
  shipping_method: string | null;
  shipping_address: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  shipping_total: number;
  total: number;
  payment_provider: "flow" | "demo";
  payment_status: StoredOrder["paymentStatus"];
  fulfillment_status: StoredOrder["fulfillmentStatus"];
  flow_token: string | null;
  flow_order_number: string | null;
  payment_url: string | null;
  inventory_deducted: boolean | null;
  paid_email_sent: boolean | null;
  promotion_code: string | null;
  created_at: Date | string;
};

type OrderItemDatabaseRow = {
  order_id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  size: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

const ordersPath = path.join(process.cwd(), "data", "orders.local.json");

async function deductInventoryForOrder(client: import("pg").PoolClient, orderId: string) {
  await client.query(
    `
      update product_variants pv
      set stock = greatest(pv.stock - oi.quantity, 0),
          updated_at = now()
      from order_items oi
      where oi.order_id = $1
        and oi.product_id = pv.product_id
        and oi.size = pv.size
    `,
    [orderId]
  );
}

async function ensureOrderRuntimeColumns(client: import("pg").PoolClient) {
  await client.query(
    "alter table orders add column if not exists inventory_deducted boolean not null default false"
  );
  await client.query(
    "alter table orders add column if not exists paid_email_sent boolean not null default false"
  );
  await client.query("alter table orders add column if not exists promotion_code text");
}

async function restoreInventoryForOrder(client: import("pg").PoolClient, orderId: string) {
  await client.query(
    `
      update product_variants pv
      set stock = pv.stock + oi.quantity,
          updated_at = now()
      from order_items oi
      where oi.order_id = $1
        and oi.product_id = pv.product_id
        and oi.size = pv.size
    `,
    [orderId]
  );
}

function mapDatabaseOrder(row: OrderDatabaseRow, items: OrderItemDatabaseRow[]): StoredOrder {
  return {
    id: row.id,
    customer: {
      name: row.customer_name ?? "",
      rut: row.customer_rut ?? "",
      email: row.customer_email,
      phone: row.customer_phone ?? "",
      region: row.shipping_region ?? "",
      commune: row.shipping_commune ?? "",
      shippingMethod: row.shipping_method === "starken" ? "starken" : "home",
      shippingAddress: row.shipping_address ?? "",
      notes: row.notes ?? ""
    },
    items: items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      imageUrl: item.image_url ?? "",
      size: item.size,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total)
    })),
    totals: {
      subtotal: Number(row.subtotal),
      automaticDiscount: 0,
      promotionDiscount: row.promotion_code ? Number(row.discount) : 0,
      discount: Number(row.discount),
      shipping: Number(row.shipping_total),
      total: Number(row.total)
    },
    promotionCode: row.promotion_code ?? "",
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    paidEmailSent: Boolean(row.paid_email_sent),
    payment: row.flow_token
      ? {
          provider: row.payment_provider,
          token: row.flow_token,
          url: row.payment_url ?? "",
          flowOrder: row.flow_order_number ? Number(row.flow_order_number) : undefined
        }
      : undefined,
    createdAt: new Date(row.created_at).toISOString()
  };
}

async function readPostgresOrders() {
  const [ordersResult, itemsResult] = await Promise.all([
    dbQuery<OrderDatabaseRow>("select * from orders order by created_at desc"),
    dbQuery<OrderItemDatabaseRow>("select * from order_items order by id")
  ]);
  const itemsByOrder = new Map<string, OrderItemDatabaseRow[]>();

  for (const item of itemsResult.rows) {
    const items = itemsByOrder.get(item.order_id) ?? [];
    items.push(item);
    itemsByOrder.set(item.order_id, items);
  }

  return ordersResult.rows.map((order) =>
    mapDatabaseOrder(order, itemsByOrder.get(order.id) ?? [])
  );
}

async function ensureOrderFile() {
  try {
    await fs.access(ordersPath);
  } catch {
    await fs.mkdir(path.dirname(ordersPath), { recursive: true });
    await fs.writeFile(ordersPath, "[]", "utf8");
  }
}

export async function readOrders(): Promise<StoredOrder[]> {
  if (isPostgresEnabled()) {
    return readPostgresOrders();
  }

  await ensureOrderFile();
  const raw = await fs.readFile(ordersPath, "utf8");
  return JSON.parse(raw) as StoredOrder[];
}

export async function saveOrder(order: ReturnType<typeof buildOrder>) {
  const customerId = await upsertCustomer({
    name: order.customer.name,
    rut: order.customer.rut,
    email: order.customer.email,
    phone: order.customer.phone,
    region: order.customer.region,
    commune: order.customer.commune,
    shippingAddress: order.customer.shippingAddress
  });

  if (isPostgresEnabled()) {
    const createdAt = new Date().toISOString();

    await withTransaction(async (client) => {
      await ensureOrderRuntimeColumns(client);

      await client.query(
        `
          insert into orders (
            id, customer_id, customer_name, customer_rut, customer_email, customer_phone,
            shipping_region, shipping_commune, shipping_method, shipping_address, notes,
            subtotal, discount, shipping_total, total, payment_status,
            fulfillment_status, promotion_code, created_at, updated_at
          ) values (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, now()
          )
        `,
        [
          order.id,
          customerId,
          order.customer.name,
          order.customer.rut,
          order.customer.email,
          order.customer.phone,
          order.customer.region,
          order.customer.commune,
          order.customer.shippingMethod,
          order.customer.shippingAddress,
          order.customer.notes,
          order.totals.subtotal,
          order.totals.discount,
          order.totals.shipping,
          order.totals.total,
          order.paymentStatus,
          order.fulfillmentStatus,
          order.promotionCode,
          createdAt
        ]
      );

      for (const item of order.items) {
        await client.query(
          `
            insert into order_items (
              order_id, product_id, variant_id, product_name, image_url, size,
              quantity, unit_price, line_total
            ) values (
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
    });

    return {
      ...order,
      createdAt
    } satisfies StoredOrder;
  }

  const orders = await readOrders();
  const storedOrder: StoredOrder = {
    ...order,
    createdAt: new Date().toISOString()
  };

  orders.unshift(storedOrder);
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), "utf8");
  return storedOrder;
}

export async function updateOrderStatus(
  id: string,
  status: Partial<Pick<StoredOrder, "paymentStatus" | "fulfillmentStatus">>
) {
  if (isPostgresEnabled()) {
    const result = await withTransaction(async (client) => {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (status.paymentStatus) {
        values.push(status.paymentStatus);
        fields.push(`payment_status = $${values.length}`);
      }
      if (status.fulfillmentStatus) {
        values.push(status.fulfillmentStatus);
        fields.push(`fulfillment_status = $${values.length}`);
      }
      if (!fields.length) return null;

      if (status.paymentStatus) {
        await ensureOrderRuntimeColumns(client);
      }

      values.push(id);
      const updateResult = await client.query<{ id: string; inventory_deducted: boolean }>(
        `update orders set ${fields.join(", ")}, updated_at = now() where id = $${values.length} returning id, inventory_deducted`,
        values
      );

      const order = updateResult.rows[0];
      if (status.paymentStatus === "paid" && order && !order.inventory_deducted) {
        await deductInventoryForOrder(client, order.id);
        await client.query(
          "update orders set inventory_deducted = true, updated_at = now() where id = $1",
          [order.id]
        );
      }

      return updateResult;
    });

    if (!result?.rowCount) return null;
    return (await readPostgresOrders()).find((order) => order.id === id) ?? null;
  }

  const orders = await readOrders();
  const orderIndex = orders.findIndex((order) => order.id === id);

  if (orderIndex === -1) {
    return null;
  }

  const updatedOrder: StoredOrder = {
    ...orders[orderIndex],
    ...status
  };

  orders[orderIndex] = updatedOrder;
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), "utf8");

  return updatedOrder;
}

export async function attachOrderPayment(id: string, payment: NonNullable<StoredOrder["payment"]>) {
  if (isPostgresEnabled()) {
    const result = await dbQuery<{ id: string }>(
      `
        update orders set
          payment_provider = $2, flow_token = $3, flow_order_number = $4,
          payment_url = $5, updated_at = now()
        where id = $1
        returning id
      `,
      [id, payment.provider, payment.token, payment.flowOrder ?? null, payment.url]
    );

    if (!result.rowCount) return null;
    return (await readPostgresOrders()).find((order) => order.id === id) ?? null;
  }

  const orders = await readOrders();
  const orderIndex = orders.findIndex((order) => order.id === id);

  if (orderIndex === -1) {
    return null;
  }

  const updatedOrder: StoredOrder = {
    ...orders[orderIndex],
    payment
  };

  orders[orderIndex] = updatedOrder;
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), "utf8");

  return updatedOrder;
}

export async function updateOrderPaymentStatusByToken(
  token: string,
  paymentStatus: StoredOrder["paymentStatus"]
) {
  if (isPostgresEnabled()) {
    const result = await withTransaction(async (client) => {
      await ensureOrderRuntimeColumns(client);

      const updateResult = await client.query<{ id: string; inventory_deducted: boolean }>(
        `
          update orders set payment_status = $2, updated_at = now()
          where flow_token = $1
          returning id, inventory_deducted
        `,
        [token, paymentStatus]
      );

      const order = updateResult.rows[0];
      if (paymentStatus === "paid" && order && !order.inventory_deducted) {
        await deductInventoryForOrder(client, order.id);
        await client.query(
          "update orders set inventory_deducted = true, updated_at = now() where id = $1",
          [order.id]
        );
      }

      return updateResult;
    });

    if (!result.rowCount) return null;
    const id = result.rows[0].id;
    return (await readPostgresOrders()).find((order) => order.id === id) ?? null;
  }

  const orders = await readOrders();
  const orderIndex = orders.findIndex((order) => order.payment?.token === token);

  if (orderIndex === -1) {
    return null;
  }

  const updatedOrder: StoredOrder = {
    ...orders[orderIndex],
    paymentStatus
  };

  orders[orderIndex] = updatedOrder;
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), "utf8");

  return updatedOrder;
}

export async function claimPaidOrderEmail(id: string) {
  if (isPostgresEnabled()) {
    return withTransaction(async (client) => {
      await ensureOrderRuntimeColumns(client);
      const result = await client.query<{ id: string }>(
        `
          update orders
          set paid_email_sent = true, updated_at = now()
          where id = $1
            and paid_email_sent = false
          returning id
        `,
        [id]
      );

      return Boolean(result.rowCount);
    });
  }

  const orders = await readOrders();
  const orderIndex = orders.findIndex((order) => order.id === id);
  if (orderIndex === -1 || orders[orderIndex].paidEmailSent) return false;

  orders[orderIndex] = {
    ...orders[orderIndex],
    paidEmailSent: true
  };
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), "utf8");
  return true;
}

export async function deleteOrder(id: string) {
  if (isPostgresEnabled()) {
    return withTransaction(async (client) => {
      await ensureOrderRuntimeColumns(client);

      const orderResult = await client.query<{ id: string; inventory_deducted: boolean }>(
        "select id, inventory_deducted from orders where id = $1",
        [id]
      );
      const order = orderResult.rows[0];

      if (!order) return false;

      if (order.inventory_deducted) {
        await restoreInventoryForOrder(client, order.id);
      }

      await client.query("delete from order_items where order_id = $1", [id]);
      await client.query("delete from orders where id = $1", [id]);
      return true;
    });
  }

  const orders = await readOrders();
  const nextOrders = orders.filter((order) => order.id !== id);
  if (nextOrders.length === orders.length) return false;

  await fs.writeFile(ordersPath, JSON.stringify(nextOrders, null, 2), "utf8");
  return true;
}

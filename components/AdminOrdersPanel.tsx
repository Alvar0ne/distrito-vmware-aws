"use client";

import { useMemo, useState } from "react";
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type StoredOrder
} from "@/lib/orderTypes";
import { formatCLP } from "@/lib/pricing";

type AdminOrdersPanelProps = {
  orders: StoredOrder[];
};

const paymentLabels: Record<OrderPaymentStatus, string> = {
  pending: "Pago pendiente",
  paid: "Pagado",
  cancelled: "Cancelado"
};

const fulfillmentLabels: Record<OrderFulfillmentStatus, string> = {
  received: "Recibido",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getShippingMethodLabel(method: string) {
  return method === "starken" ? "Sucursal de Starken" : "Envio a domicilio";
}

function getItemDetail(size: string, quantity: number) {
  const quantityText = `${quantity} unidad${quantity === 1 ? "" : "es"}`;
  return size === "U" ? quantityText : `Talla ${size} · ${quantityText}`;
}

function isAutomaticFlowPayment(order: StoredOrder) {
  return order.payment?.provider === "flow";
}

export function AdminOrdersPanel({ orders }: AdminOrdersPanelProps) {
  const [localOrders, setLocalOrders] = useState(orders);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | OrderPaymentStatus>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<"all" | OrderFulfillmentStatus>("all");
  const [savingOrderId, setSavingOrderId] = useState("");
  const [deletingOrderId, setDeletingOrderId] = useState("");
  const [message, setMessage] = useState("");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());

    return localOrders.filter((order) => {
      const haystack = normalizeText(
        [
          order.id,
          order.customer.name,
          order.customer.rut,
          order.customer.email,
          order.customer.phone,
          order.customer.region,
          order.customer.commune,
          order.customer.shippingAddress,
          ...order.items.map((item) => item.productName)
        ].join(" ")
      );
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter;
      const matchesFulfillment =
        fulfillmentFilter === "all" || order.fulfillmentStatus === fulfillmentFilter;

      return matchesQuery && matchesPayment && matchesFulfillment;
    });
  }, [fulfillmentFilter, localOrders, paymentFilter, query]);

  const paidTotal = localOrders
    .filter((order) => order.paymentStatus === "paid")
    .reduce((sum, order) => sum + order.totals.total, 0);
  const pendingOrders = localOrders.filter((order) => order.paymentStatus === "pending").length;
  const preparingOrders = localOrders.filter((order) =>
    ["received", "preparing"].includes(order.fulfillmentStatus)
  ).length;

  async function updateStatus(
    orderId: string,
    status: Partial<Pick<StoredOrder, "paymentStatus" | "fulfillmentStatus">>
  ) {
    setSavingOrderId(orderId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(status)
      });
      const data = (await response.json()) as { order?: StoredOrder; error?: string };

      if (!response.ok || !data.order) {
        throw new Error(data.error ?? "No se pudo actualizar el pedido.");
      }

      setLocalOrders((current) =>
        current.map((order) => (order.id === data.order?.id ? data.order : order))
      );
      setMessage(`Pedido ${orderId} actualizado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el pedido.");
    } finally {
      setSavingOrderId("");
    }
  }

  async function removeOrder(orderId: string) {
    const confirmed = window.confirm(`¿Eliminar el pedido ${orderId}?`);
    if (!confirmed) return;

    setDeletingOrderId(orderId);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE"
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo eliminar el pedido.");
      }

      setLocalOrders((current) => current.filter((order) => order.id !== orderId));
      setMessage(`Pedido ${orderId} eliminado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el pedido.");
    } finally {
      setDeletingOrderId("");
    }
  }

  return (
    <section className="adminPanel">
      <div className="panelHead ordersPanelHead">
        <div>
          <h2>Pedidos</h2>
          <span>{filteredOrders.length} pedido(s) visibles</span>
        </div>
        <a href="/admin?section=pedidos">Actualizar</a>
      </div>

      <div className="orderStatsGrid">
        <article>
          <span>Total pedidos</span>
          <strong>{localOrders.length}</strong>
        </article>
        <article>
          <span>Pendientes de pago</span>
          <strong>{pendingOrders}</strong>
        </article>
        <article>
          <span>Por preparar</span>
          <strong>{preparingOrders}</strong>
        </article>
        <article>
          <span>Pagado confirmado</span>
          <strong>{formatCLP(paidTotal)}</strong>
        </article>
      </div>

      <div className="adminFilterBar ordersFilterBar">
        <label className="adminFilterGroup">
          Buscar pedido
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pedido, cliente, RUT, correo, producto"
            value={query}
          />
        </label>
        <label className="adminFilterGroup">
          Pago
          <select
            onChange={(event) => setPaymentFilter(event.target.value as "all" | OrderPaymentStatus)}
            value={paymentFilter}
          >
            <option value="all">Todos</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {paymentLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="adminFilterGroup">
          Despacho
          <select
            onChange={(event) =>
              setFulfillmentFilter(event.target.value as "all" | OrderFulfillmentStatus)
            }
            value={fulfillmentFilter}
          >
            <option value="all">Todos</option>
            {FULFILLMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {fulfillmentLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? <div className="adminInlineMessage">{message}</div> : null}

      <div className="ordersList">
        {filteredOrders.length ? (
          filteredOrders.map((order) => (
            <article className="orderCard" key={order.id}>
              <div className="orderCardTop">
                <div>
                  <span>{formatDate(order.createdAt)}</span>
                  <h3>{order.id}</h3>
                </div>
                <div className="orderBadges">
                  <span className={`statusBadge payment-${order.paymentStatus}`}>
                    {paymentLabels[order.paymentStatus]}
                  </span>
                  <span className={`statusBadge fulfillment-${order.fulfillmentStatus}`}>
                    {fulfillmentLabels[order.fulfillmentStatus]}
                  </span>
                </div>
              </div>

              <div className="orderDetailGrid">
                <section>
                  <h4>Cliente</h4>
                  <p>{order.customer.name}</p>
                  <span>RUT: {order.customer.rut}</span>
                  <span>{order.customer.email}</span>
                  <span>{order.customer.phone}</span>
                </section>

                <section>
                  <h4>Despacho</h4>
                  <p>{getShippingMethodLabel(order.customer.shippingMethod)}</p>
                  <span>{order.customer.region}</span>
                  <span>{order.customer.commune}</span>
                  <span>{order.customer.shippingAddress}</span>
                  {order.customer.notes ? <em>{order.customer.notes}</em> : null}
                </section>

                <section>
                  <h4>Productos</h4>
                  <div className="orderItems">
                    {order.items.map((item) => (
                      <div className="orderItemLine" key={`${order.id}-${item.productId}-${item.size}`}>
                        <img
                          alt={item.productName}
                          className="orderItemImage"
                          src={item.imageUrl || "/placeholder-product.jpg"}
                        />
                        <span className="orderItemCopy">
                          <strong>{item.productName}</strong>
                          <small>{getItemDetail(item.size, item.quantity)}</small>
                        </span>
                        <b>{formatCLP(item.lineTotal)}</b>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4>Total</h4>
                  <dl className="orderTotals">
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{formatCLP(order.totals.subtotal)}</dd>
                    </div>
                    <div>
                      <dt>Descuento</dt>
                      <dd>{formatCLP(order.totals.discount)}</dd>
                    </div>
                    <div>
                      <dt>Envio</dt>
                      <dd>{order.totals.shipping ? formatCLP(order.totals.shipping) : "Por pagar"}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{formatCLP(order.totals.total)}</dd>
                    </div>
                  </dl>
                  {order.payment ? (
                    <span>
                      Pago: {order.payment.provider === "flow" ? "Flow" : "Demo"} ·{" "}
                      {order.payment.flowOrder ? `Orden ${order.payment.flowOrder}` : order.payment.token}
                    </span>
                  ) : null}
                </section>
              </div>

              <div className="orderActions">
                <label>
                  Estado de pago
                  {isAutomaticFlowPayment(order) ? (
                    <div className={`lockedStatusField lockedStatusField-${order.paymentStatus}`}>
                      {paymentLabels[order.paymentStatus]}
                      <small>Automatico por Flow</small>
                    </div>
                  ) : (
                    <select
                      disabled={savingOrderId === order.id}
                      onChange={(event) =>
                        updateStatus(order.id, {
                          paymentStatus: event.target.value as OrderPaymentStatus
                        })
                      }
                      value={order.paymentStatus}
                    >
                      {PAYMENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {paymentLabels[status]}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label>
                  Estado de despacho
                  <select
                    disabled={savingOrderId === order.id || deletingOrderId === order.id}
                    onChange={(event) =>
                      updateStatus(order.id, {
                        fulfillmentStatus: event.target.value as OrderFulfillmentStatus
                      })
                    }
                    value={order.fulfillmentStatus}
                  >
                    {FULFILLMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {fulfillmentLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  aria-label={`Eliminar pedido ${order.id}`}
                  className="adminDeleteProduct orderDeleteButton"
                  disabled={savingOrderId === order.id || deletingOrderId === order.id}
                  onClick={() => removeOrder(order.id)}
                  title="Eliminar pedido"
                  type="button"
                >
                  <span className="trashIcon" aria-hidden="true">
                    <i />
                  </span>
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="emptyAdminState">
            <strong>Aun no hay pedidos con esos filtros.</strong>
            <span>Crea un pedido desde checkout o cambia los filtros para ver resultados.</span>
          </div>
        )}
      </div>
    </section>
  );
}

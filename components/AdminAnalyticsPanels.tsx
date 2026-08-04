import type { StoredCustomer } from "@/lib/customerStore";
import type { StoredOrder } from "@/lib/orderTypes";
import type { Product } from "@/lib/products";
import { formatCLP } from "@/lib/pricing";
import type { VisitPoint } from "@/lib/analyticsStore";
import { AdminVisitsChart } from "./AdminVisitsChart";

type AdminAnalyticsProps = {
  customers: StoredCustomer[];
  orders: StoredOrder[];
  products: Product[];
  visits?: VisitPoint[];
};

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function getPaidOrders(orders: StoredOrder[]) {
  return orders.filter((order) => order.paymentStatus === "paid");
}

function getAverageOrder(orders: StoredOrder[]) {
  if (!orders.length) return 0;
  return Math.round(orders.reduce((sum, order) => sum + order.totals.total, 0) / orders.length);
}

export function AdminAnalyticsSummary({ customers, orders, products, visits = [] }: AdminAnalyticsProps) {
  const paidOrders = getPaidOrders(orders);
  const revenue = paidOrders.reduce((sum, order) => sum + order.totals.total, 0);
  const todayOrders = orders.filter((order) => isToday(order.createdAt));
  const lowStock = products.filter(
    (product) => Object.values(product.stockBySize).reduce((sum, stock) => sum + stock, 0) <= 1
  ).length;
  const returningCustomers = customers.filter((customer) => customer.orderCount > 1).length;

  return (
    <>
      <section className="analyticsKpiGrid">
        <article>
          <span>Ganancia</span>
          <strong>{formatCLP(revenue)}</strong>
        </article>
        <article>
          <span>Pedidos pagados</span>
          <strong>{paidOrders.length}</strong>
        </article>
        <article>
          <span>Valor promedio del pedido</span>
          <strong>{orders.length ? formatCLP(getAverageOrder(orders)) : "-"}</strong>
        </article>
        <article>
          <span>Clientes que regresan</span>
          <strong>{returningCustomers}</strong>
        </article>
        <article>
          <span>Pedidos de hoy</span>
          <strong>{todayOrders.length}</strong>
        </article>
        <article>
          <span>Productos con stock bajo</span>
          <strong>{lowStock}</strong>
        </article>
      </section>

      <AdminVisitsChart visits={visits} />
    </>
  );
}

export function AdminRealtimePanel({ orders, products }: AdminAnalyticsProps) {
  const todayOrders = orders.filter((order) => isToday(order.createdAt));
  const todayRevenue = todayOrders
    .filter((order) => order.paymentStatus === "paid")
    .reduce((sum, order) => sum + order.totals.total, 0);
  const recentActivity = [
    ...orders.slice(0, 4).map((order) => ({
      label: `Nuevo pedido ${order.id}`,
      detail: `${order.customer.commune || order.customer.region} · ${formatCLP(order.totals.total)}`
    })),
    ...products.slice(0, 2).map((product) => ({
      label: `Producto visitado ${product.name}`,
      detail: product.brand || "Distrito Miami"
    }))
  ].slice(0, 5);

  return (
    <>
      <section className="realtimeTop">
        <h2>En tiempo real <span /></h2>
      </section>

      <section className="analyticsKpiGrid realtimeKpis">
        <article>
          <span>Ganancia</span>
          <strong>{formatCLP(todayRevenue)}</strong>
          <small>Hasta ahora, el dia de hoy</small>
        </article>
        <article>
          <span>Pedidos</span>
          <strong>{todayOrders.length}</strong>
          <small>Hasta ahora, el dia de hoy</small>
        </article>
        <article>
          <span>Carros activos</span>
          <strong>0</strong>
          <small>Preparado para tracking real</small>
        </article>
      </section>

      <section className="realtimeGrid">
        <article className="adminPanel realtimeMap">
          <div>
            <strong>Visitantes en este momento</strong>
            <span>0</span>
            <small>Activo en los ultimos 5 minutos</small>
          </div>
          <div className="liveGlobe" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </article>
        <article className="adminPanel realtimeActivity">
          <div className="panelHead">
            <h2>Ultima actividad</h2>
          </div>
          <div className="activityFeed">
            {recentActivity.map((item) => (
              <div key={`${item.label}-${item.detail}`}>
                <span />
                <p>{item.label}<small>{item.detail}</small></p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

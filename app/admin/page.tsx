import { AdminShell, adminSections, type AdminSection } from "@/components/AdminShell";
import { AdminAnalyticsSummary, AdminRealtimePanel } from "@/components/AdminAnalyticsPanels";
import { AdminBrevoAppPanel } from "@/components/AdminBrevoAppPanel";
import { AdminCustomersPanel } from "@/components/AdminCustomersPanel";
import { AdminOrdersPanel } from "@/components/AdminOrdersPanel";
import { AdminProductsPanel } from "@/components/AdminProductsPanel";
import { AdminPromotionsPanel } from "@/components/AdminPromotionsPanel";
import { getBrevoStatus } from "@/lib/brevo";
import { readVisitSeries } from "@/lib/analyticsStore";
import { readCustomers } from "@/lib/customerStore";
import { readOrders } from "@/lib/orderStore";
import { formatCLP } from "@/lib/pricing";
import { readStoredProducts } from "@/lib/productStore";
import { readPromotions } from "@/lib/promotionStore";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    section?: string;
  }>;
};

function getSection(value?: string): AdminSection {
  const normalizedValue = value === "aplicaciones-correos" ? "aplicaciones-brevo" : value;
  return adminSections.some(
    (section) =>
      section.id === normalizedValue ||
      ("children" in section && section.children.some((child) => child.id === normalizedValue))
  )
    ? (normalizedValue as AdminSection)
    : "inicio";
}

function getSectionLabel(sectionId: AdminSection) {
  for (const section of adminSections) {
    if (section.id === sectionId) return section.label;
    if ("children" in section) {
      const child = section.children.find((item) => item.id === sectionId);
      if (child) return child.label;
    }
  }

  return "Inicio";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const currentSection = getSection(params.section);
  const [orders, products, customers, promotions, visits] = await Promise.all([
    readOrders(),
    readStoredProducts(),
    readCustomers(),
    readPromotions(),
    readVisitSeries(90)
  ]);
  const brevoStatus = getBrevoStatus();
  const totalStock = products.reduce(
    (sum, product) => sum + Object.values(product.stockBySize).reduce((a, b) => a + b, 0),
    0
  );
  const featuredProducts = products.filter((product) => product.featured).length;
  const lowStockProducts = products.filter(
    (product) => Object.values(product.stockBySize).reduce((sum, stock) => sum + stock, 0) <= 1
  ).length;

  const sectionCounts = {
    orders: orders.filter((order) => order.fulfillmentStatus === "received").length,
    products: products.length
  };

  return (
    <AdminShell counts={sectionCounts} currentSection={currentSection}>
        <div className="adminTop">
          <div>
            <p className="eyebrow">Distrito Miami</p>
            <h1>{getSectionLabel(currentSection)}</h1>
          </div>
          <a href="/">Volver a tienda</a>
        </div>

        {currentSection === "inicio" ? (
          <>
            <section className="adminWelcome">
              <div>
                <p className="eyebrow">Resumen</p>
                <h2>Buenos dias</h2>
                <span>
                  Vista inicial del negocio. Despues definimos aqui los indicadores mas utiles.
                </span>
              </div>
            </section>

            <section className="statsGrid">
              <article>
                <span>Productos</span>
                <strong>{products.length}</strong>
              </article>
              <article>
                <span>Stock total</span>
                <strong>{totalStock}</strong>
              </article>
              <article>
                <span>Pedidos</span>
                <strong>{orders.length}</strong>
              </article>
              <article>
                <span>Destacados</span>
                <strong>{featuredProducts}</strong>
              </article>
            </section>

            <section className="adminPanel">
              <div className="panelHead">
                <h2>Actividad reciente</h2>
                <a href="/admin?section=pedidos">Ver pedidos</a>
              </div>
              <div className="adminQuickGrid">
                <article>
                  <strong>{orders[0]?.id ?? "Sin pedidos aun"}</strong>
                  <span>
                    {orders[0]
                      ? `${orders[0].customer.name} · ${formatCLP(orders[0].totals.total)}`
                      : "Crea un pedido desde checkout para verlo aqui."}
                  </span>
                </article>
                <article>
                  <strong>{lowStockProducts} con stock bajo</strong>
                  <span>Productos con una unidad o menos disponibles.</span>
                </article>
              </div>
            </section>
          </>
        ) : null}

        {currentSection === "pedidos" ? (
          <AdminOrdersPanel orders={orders} />
        ) : null}

        {currentSection === "productos" ? (
          <AdminProductsPanel products={products} />
        ) : null}

        {currentSection === "estadisticas-resumen" ? (
          <AdminAnalyticsSummary customers={customers} orders={orders} products={products} visits={visits} />
        ) : null}

        {currentSection === "estadisticas-tiempo-real" ? (
          <AdminRealtimePanel customers={customers} orders={orders} products={products} />
        ) : null}

        {currentSection === "promociones" ? (
          <AdminPromotionsPanel promotions={promotions} />
        ) : null}

        {currentSection === "aplicaciones-brevo" ? (
          <AdminBrevoAppPanel customers={customers} status={brevoStatus} />
        ) : null}

        {currentSection === "clientes" ? (
          <AdminCustomersPanel customers={customers} />
        ) : null}

        {currentSection === "configuracion" ? (
          <section className="adminPanel">
            <div className="panelHead">
              <h2>Configuracion</h2>
            </div>
            <div className="emptyAdminState">
              <strong>Configuracion pendiente.</strong>
              <span>Aqui pondremos pagos, envios, datos de tienda y reglas comerciales.</span>
            </div>
          </section>
        ) : null}
    </AdminShell>
  );
}

import type { ReactNode } from "react";

export const adminSections = [
  { id: "inicio", label: "Inicio", count: null },
  { id: "pedidos", label: "Pedidos", count: "orders" },
  { id: "productos", label: "Productos", count: "products" },
  {
    id: "estadisticas-resumen",
    label: "Estadisticas",
    count: null,
    children: [
      { id: "estadisticas-resumen", label: "Resumen" },
      { id: "estadisticas-tiempo-real", label: "En tiempo real" }
    ]
  },
  { id: "promociones", label: "Promociones", count: null },
  {
    id: "aplicaciones-brevo",
    label: "Aplicaciones",
    count: null,
    children: [
      { id: "aplicaciones-brevo", label: "Brevo" }
    ]
  },
  { id: "clientes", label: "Clientes", count: null },
  { id: "configuracion", label: "Configuracion", count: null }
] as const;

type AdminParentSection = (typeof adminSections)[number];
type AdminChildSection = Extract<AdminParentSection, { children: readonly unknown[] }>["children"][number];
export type AdminSection = AdminParentSection["id"] | AdminChildSection["id"];

type AdminShellProps = {
  children: ReactNode;
  counts?: {
    orders: number;
    products: number;
  };
  currentSection: AdminSection;
};

export function AdminShell({ children, counts, currentSection }: AdminShellProps) {
  return (
    <main className="adminAppShell">
      <aside className="adminSidebar">
        <a className="adminBrand" href="/admin">
          <img alt="Distrito Miami" src="/distrito-miami-logo.png" />
          <span>
            <strong>Distrito Miami</strong>
            Panel privado
          </span>
        </a>

        <nav className="adminMenu" aria-label="Panel admin">
          {adminSections.map((section) => {
            const countKey = section.count;
            const count = countKey && counts ? counts[countKey] : null;
            const isActive =
              currentSection === section.id ||
              ("children" in section &&
                section.children.some((child) => child.id === currentSection));
            return (
              <div className={`adminMenuGroup ${isActive ? "open" : ""}`} key={section.id}>
                <a
                  className={isActive ? "active" : ""}
                  href={`/admin?section=${section.id}`}
                >
                  <span>{section.label}</span>
                  {count !== null && count > 0 ? <strong>{count}</strong> : null}
                  {"children" in section ? <em aria-hidden="true">^</em> : null}
                </a>
                {"children" in section ? (
                  <div className="adminSubmenu">
                    {section.children.map((child) => (
                      <a
                        className={currentSection === child.id ? "activeSub" : ""}
                        href={`/admin?section=${child.id}`}
                        key={child.id}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <a className="adminStoreLink" href="/">
          Ver tienda
        </a>
        <form action="/api/admin/auth/logout" method="post">
          <button className="adminLogoutButton" type="submit">Cerrar sesion</button>
        </form>
      </aside>

      <section className="adminContent">{children}</section>
    </main>
  );
}

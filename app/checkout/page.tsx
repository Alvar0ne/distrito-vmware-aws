import { CheckoutForm } from "@/components/CheckoutForm";
import { readStoredProducts } from "@/lib/productStore";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const products = await readStoredProducts();

  return (
    <main className="checkoutPage">
      <header className="checkoutBrandHeader">
        <a aria-label="Volver a Distrito Miami" href="/">
          <img alt="Distrito Miami Importaciones" src="/distrito-miami-logo.png" />
        </a>
      </header>

      <nav aria-label="Progreso de compra" className="checkoutSteps">
        <a href="/">Carro</a>
        <span aria-hidden="true">›</span>
        <strong aria-current="step">Proceso de pago</strong>
        <span aria-hidden="true">›</span>
        <span>Revision del pedido</span>
        <span aria-hidden="true">›</span>
        <span>Exito</span>
      </nav>

      <section className="checkoutShell">
        <CheckoutForm products={products} />
      </section>
    </main>
  );
}

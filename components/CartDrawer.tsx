"use client";

import { calculateCart, formatCLP, type CartLine } from "@/lib/pricing";
import { formatCartLineDetail } from "@/lib/productDisplay";
import type { Product } from "@/lib/products";

type CartDrawerProps = {
  lines: CartLine[];
  products: Product[];
  onRemove: (productId: string, size: string) => void;
};

export function CartDrawer({ lines, products, onRemove }: CartDrawerProps) {
  const totals = calculateCart(lines, products);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (lines.length === 0) return null;

  return (
    <aside className="cartDrawer" aria-label="Carrito">
      <div className="cartTop">
        <strong>Carrito</strong>
        <span>{itemCount} producto(s)</span>
      </div>
      <div className="cartLines">
        {lines.map((line) => {
            const product = products.find((item) => item.id === line.productId);
            if (!product) return null;
            return (
              <div className="cartLine" key={`${line.productId}-${line.size}`}>
                <div>
                  <strong>{product.name}</strong>
                  <span>{formatCartLineDetail(product, line.size, line.quantity)}</span>
                </div>
                <button onClick={() => onRemove(line.productId, line.size)} type="button">
                  Quitar
                </button>
              </div>
            );
          })}
      </div>
      <dl className="totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatCLP(totals.subtotal)}</dd>
        </div>
        <div>
          <dt>Descuento</dt>
          <dd>{formatCLP(totals.discount)}</dd>
        </div>
        <div className="grandTotal">
          <dt>Total</dt>
          <dd>{formatCLP(totals.total)}</dd>
        </div>
      </dl>
      <a className="checkoutButton" href="/checkout">
        Ir al checkout
      </a>
    </aside>
  );
}

"use client";

import { useMemo, useState } from "react";
import { CART_STORAGE_KEY, normalizeCartLines } from "@/lib/cart";
import type { CartLine } from "@/lib/pricing";

type ProductPurchasePanelProps = {
  hideSizes: boolean;
  productId: string;
  sizes: string[];
  stockBySize: Record<string, number>;
};

export function ProductPurchasePanel({
  hideSizes,
  productId,
  sizes,
  stockBySize
}: ProductPurchasePanelProps) {
  const firstAvailableSize = useMemo(
    () => sizes.find((size) => (stockBySize[size] ?? 0) > 0) ?? sizes[0] ?? "U",
    [sizes, stockBySize]
  );
  const [selectedSize, setSelectedSize] = useState(firstAvailableSize);
  const [message, setMessage] = useState("");
  const selectedStock = stockBySize[selectedSize] ?? 0;
  const totalStock = Object.values(stockBySize).reduce((sum, stock) => sum + stock, 0);

  function addProduct(redirectToCheckout: boolean) {
    if (selectedStock <= 0) return;

    let current: CartLine[] = [];
    try {
      current = normalizeCartLines(
        JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]") as CartLine[]
      );
    } catch {
      current = [];
    }

    const existing = current.find(
      (line) => line.productId === productId && line.size === selectedSize
    );
    const next = existing
      ? current.map((line) =>
          line.productId === productId && line.size === selectedSize
            ? { ...line, quantity: line.quantity + 1 }
            : line
        )
      : [...current, { productId, size: selectedSize, quantity: 1 }];

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    if (redirectToCheckout) {
      window.location.assign("/checkout");
      return;
    }

    setMessage("Producto agregado al carrito.");
  }

  return (
    <div className="productPurchasePanel">
      {hideSizes ? null : (
        <div className="productSizeSelector">
          <div className="productPurchaseHeading">
            <strong>Selecciona tu talla</strong>
            <span>{selectedStock} disponible(s)</span>
          </div>
          <div className="detailSizes" role="group" aria-label="Tallas disponibles">
            {sizes.map((size) => {
              const stock = stockBySize[size] ?? 0;
              return (
                <button
                  aria-pressed={selectedSize === size}
                  className={selectedSize === size ? "active" : ""}
                  disabled={stock <= 0}
                  key={size}
                  onClick={() => {
                    setSelectedSize(size);
                    setMessage("");
                  }}
                  type="button"
                >
                  {size}
                  <small>{stock > 0 ? `${stock} disp.` : "Agotada"}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="productPurchaseActions">
        <button
          className="productAddButton"
          disabled={totalStock <= 0 || selectedStock <= 0}
          onClick={() => addProduct(false)}
          type="button"
        >
          Agregar al carrito
        </button>
        <button
          className="productBuyButton"
          disabled={totalStock <= 0 || selectedStock <= 0}
          onClick={() => addProduct(true)}
          type="button"
        >
          Comprar ahora
        </button>
      </div>

      {message ? <p className="productPurchaseMessage" role="status">{message}</p> : null}
      {totalStock <= 0 ? <p className="productOutOfStock">Producto agotado.</p> : null}
    </div>
  );
}

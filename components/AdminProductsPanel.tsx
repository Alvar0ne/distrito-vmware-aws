"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { shouldHideProductSizes } from "@/lib/productDisplay";
import { categories, type Product, type ProductCategory } from "@/lib/products";
import { formatCLP } from "@/lib/pricing";

type AdminProductsPanelProps = {
  products: Product[];
};

function getStockTotal(product: Product) {
  return Object.values(product.stockBySize).reduce((sum, stock) => sum + stock, 0);
}

function getCategoryLabel(category: ProductCategory) {
  return categories.find((item) => item.id === category)?.label ?? category;
}

export function AdminProductsPanel({ products }: AdminProductsPanelProps) {
  const router = useRouter();
  const [currentProducts, setCurrentProducts] = useState(products);
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [size, setSize] = useState("all");
  const [onlyOutOfStock, setOnlyOutOfStock] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setCurrentProducts(products);
  }, [products]);

  const availableSizes = useMemo(() => {
    const filteredByCategory =
      category === "all"
        ? currentProducts
        : currentProducts.filter((product) => product.category === category);
    return Array.from(
      new Set(
        filteredByCategory.flatMap((product) =>
          shouldHideProductSizes(product) ? [] : product.sizes
        )
      )
    ).sort((a, b) => a.localeCompare(b, "es-CL", { numeric: true })
    );
  }, [category, currentProducts]);

  const filteredProducts = useMemo(() => {
    return currentProducts.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesSize =
        size === "all" || (!shouldHideProductSizes(product) && product.sizes.includes(size));
      const matchesStock = !onlyOutOfStock || getStockTotal(product) <= 0;
      return matchesCategory && matchesSize && matchesStock;
    });
  }, [category, currentProducts, onlyOutOfStock, size]);

  function handleCategoryChange(value: ProductCategory | "all") {
    setCategory(value);
    setSize("all");
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setDeletingId(product.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "DELETE"
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "No se pudo eliminar el producto.");

      setCurrentProducts((current) => current.filter((item) => item.id !== product.id));
      setMessage({ type: "success", text: `Producto "${product.name}" eliminado.` });
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "No se pudo eliminar el producto."
      });
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="adminPanel">
      <div className="panelHead">
        <div>
          <h2>Productos</h2>
          <span>{filteredProducts.length} producto(s) visibles</span>
        </div>
        <Link className="adminPanelAction" href="/admin/productos/nuevo">
          Nuevo producto
        </Link>
      </div>

      <div className="adminFilterBar">
        <label className="adminFilterGroup">
          Tipo de producto
          <select
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value as ProductCategory | "all")}
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="adminFilterGroup">
          Talla
          <select value={size} onChange={(event) => setSize(event.target.value)}>
            <option value="all">Todas</option>
            {availableSizes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="adminCheckFilter">
          <input
            checked={onlyOutOfStock}
            onChange={(event) => setOnlyOutOfStock(event.target.checked)}
            type="checkbox"
          />
          <span>Sin stock</span>
        </label>
      </div>

      {message ? (
        <div className={`adminProductMessage ${message.type}`} role="status">{message.text}</div>
      ) : null}

      <div className="adminProductsList">
        {filteredProducts.length ? (
          filteredProducts.map((product) => (
            <article className="adminProductRow" key={product.id}>
              <img
                alt={product.name}
                className="adminProductThumb"
                src={product.images[0] ?? "/placeholder-product.jpg"}
              />
              <div className="adminProductInfo">
                <strong>{product.name}</strong>
                <span>
                  {product.brand || "Sin marca"} · {getCategoryLabel(product.category)}
                </span>
                <small>
                  {shouldHideProductSizes(product)
                    ? `Stock: ${getStockTotal(product)}`
                    : `Tallas: ${product.sizes.join(", ")} · Stock: ${getStockTotal(product)}`}
                </small>
              </div>
              <strong className="adminProductPrice">{formatCLP(product.price)}</strong>
              <div className="adminRowActions">
                <Link href={`/admin/productos/${product.id}/editar`}>Editar</Link>
                <button
                  aria-label={`Eliminar ${product.name}`}
                  className="adminDeleteProduct"
                  disabled={deletingId === product.id}
                  onClick={() => deleteProduct(product)}
                  title={`Eliminar ${product.name}`}
                  type="button"
                >
                  <span aria-hidden="true" className="trashIcon"><i /></span>
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="emptyAdminState">
            <strong>No hay productos con esos filtros.</strong>
            <span>Cambia el tipo de producto o la talla para ver mas resultados.</span>
          </div>
        )}
      </div>
    </section>
  );
}

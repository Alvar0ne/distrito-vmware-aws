"use client";

import { useEffect, useMemo, useState } from "react";
import { shouldHideProductSizes } from "@/lib/productDisplay";
import { categories, type Product, type ProductCategory } from "@/lib/products";
import { formatCLP } from "@/lib/pricing";

type ProductGridProps = {
  products: Product[];
  onAdd: (productId: string, size: string) => void;
};

export function ProductGrid({ products, onAdd }: ProductGridProps) {
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [size, setSize] = useState<string | "all">("all");

  useEffect(() => {
    const syncFiltersFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const nextCategory = params.get("category") as ProductCategory | null;
      const nextSize = params.get("size");
      const categoryExists = categories.some((item) => item.id === nextCategory);

      setCategory(categoryExists && nextCategory ? nextCategory : "all");
      setSize(nextSize || "all");
    };

    syncFiltersFromUrl();
    window.addEventListener("popstate", syncFiltersFromUrl);
    window.addEventListener("hashchange", syncFiltersFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFiltersFromUrl);
      window.removeEventListener("hashchange", syncFiltersFromUrl);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesSize =
        size === "all" || (!shouldHideProductSizes(product) && product.sizes.includes(size));
      return matchesCategory && matchesSize;
    });
  }, [category, products, size]);

  const availableSizes = useMemo(() => {
    const sizeOrder = ["XS", "S", "M", "L", "XL", "U"];
    const scopedProducts =
      category === "all" ? products : products.filter((product) => product.category === category);

    return Array.from(
      new Set(
        scopedProducts.flatMap((product) => (shouldHideProductSizes(product) ? [] : product.sizes))
      )
    ).sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b));
  }, [category, products]);

  function updateFilters(nextCategory: ProductCategory | "all", nextSize: string | "all") {
    setCategory(nextCategory);
    setSize(nextSize);

    const params = new URLSearchParams();
    if (nextCategory !== "all") params.set("category", nextCategory);
    if (nextSize !== "all") params.set("size", nextSize);
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}#productos`;

    window.history.pushState(null, "", nextUrl);
  }

  const title =
    category === "all"
      ? "Todos los productos"
      : `${categories.find((item) => item.id === category)?.label ?? "Productos"}${
          size === "all" ? "" : ` talla ${size}`
        }`;

  return (
    <section className="catalog" id="productos">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">Catalogo</p>
          <h2>{title}</h2>
          <p className="resultCount">{filteredProducts.length} producto(s)</p>
        </div>
        <div className="filters" aria-label="Filtros de categoria">
          {categories.map((item) => (
            <button
              className={item.id === category ? "chip active" : "chip"}
              key={item.id}
              onClick={() => updateFilters(item.id, "all")}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sizeFilters" aria-label="Filtros de talla">
        <button
          className={size === "all" ? "sizeFilter active" : "sizeFilter"}
          onClick={() => updateFilters(category, "all")}
          type="button"
        >
          Todas las tallas
        </button>
        {availableSizes.map((item) => (
          <button
            className={item === size ? "sizeFilter active" : "sizeFilter"}
            key={item}
            onClick={() => updateFilters(category, item)}
            type="button"
          >
            {item === "U" ? "Sin talla" : item}
          </button>
        ))}
      </div>

      <div className="productGrid">
        {filteredProducts.length === 0 ? (
          <div className="emptyState">
            <strong>No hay productos para este filtro.</strong>
            <span>Prueba otra talla o vuelve a ver todos los productos.</span>
          </div>
        ) : null}

        {filteredProducts.map((product) => {
          const hideSizes = shouldHideProductSizes(product);
          const compareAtPrice = product.compareAtPrice;
          const isOnSale = Boolean(compareAtPrice && compareAtPrice > product.price);
          const firstAvailableSize =
            product.sizes.find((size) => product.stockBySize[size] > 0) ?? product.sizes[0];

          return (
            <article className="productCard" key={product.id}>
              <a className="productImageLink" href={`/producto/${product.id}`}>
                <figure>
                  <img src={product.images[0]} alt={product.name} />
                  {isOnSale ? (
                    <img
                      alt="Oferta especial"
                      className="saleBadgeImage"
                      src="/oferta-especial.png"
                    />
                  ) : null}
                  {product.featured ? <span className="badge">Destacado</span> : null}
                </figure>
              </a>
              <div className="productBody">
                <div className="productMeta">
                  <span>{product.brand}</span>
                  <span>{product.category}</span>
                </div>
                <h3>
                  <a href={`/producto/${product.id}`}>{product.name}</a>
                </h3>
                {hideSizes ? (
                  <div aria-hidden="true" className="sizeRow sizeRowEmpty" />
                ) : (
                  <div className="sizeRow">
                    {product.sizes.map((size) => (
                      <span className="size" key={size}>
                        {size}
                      </span>
                    ))}
                  </div>
                )}
                <div className="buyRow">
                  <div className="cardPrice">
                    {isOnSale ? (
                      <span>{formatCLP(compareAtPrice ?? 0)}</span>
                    ) : null}
                    <strong>{formatCLP(product.price)}</strong>
                  </div>
                  <div className="buyActions">
                    <a href={`/producto/${product.id}`}>Ver</a>
                    <button onClick={() => onAdd(product.id, firstAvailableSize)} type="button">
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { CartDrawer } from "@/components/CartDrawer";
import { ProductGrid } from "@/components/ProductGrid";
import { CART_STORAGE_KEY, normalizeCartLines } from "@/lib/cart";
import { shouldHideProductSizes } from "@/lib/productDisplay";
import { categories, type Product, type ProductCategory } from "@/lib/products";
import type { CartLine } from "@/lib/pricing";

type StorefrontClientProps = {
  products: Product[];
};

const categoryFeatureImages: Record<ProductCategory, string> = {
  poleras: "/category-poleras-v2.webp",
  polerones: "/category-polerones-v2.webp",
  chaquetas: "/category-chaquetas-v2.webp",
  accesorios: "/category-accesorios-v2.webp",
  conjuntos: "/category-conjuntos-v2.webp"
};

const categoryFeatureCutouts: Record<ProductCategory, string> = {
  poleras: "/category-cutouts/poleras.webp",
  polerones: "/category-cutouts/polerones.webp",
  chaquetas: "/category-cutouts/chaquetas.webp",
  accesorios: "/category-cutouts/accesorios.webp",
  conjuntos: "/category-cutouts/conjuntos.webp"
};

const importedBrands = [
  { name: "Guess", logo: "/brands/guess-user-v3.jpg" },
  { name: "Tommy Hilfiger", logo: "/brands/tommy-user.png" },
  { name: "Lacoste", logo: "/brands/lacoste-user.png" },
  { name: "Hugo Boss", logo: "/brands/hugo-boss.svg", inverted: true },
  { name: "Armani Exchange", logo: "/brands/armani-exchange.png", larger: true },
  { name: "Calvin Klein", logo: "/brands/calvin-klein-user.jpg", larger: true, largest: true },
  { name: "Michael Kors", logo: "/brands/michael-kors-user.jpg", larger: true }
];

const instagramGallery = [
  { src: "/instagram/instagram-1.webp", alt: "Campaña Día del Padre de Distrito Miami" },
  { src: "/instagram/instagram-2.webp", alt: "Chaqueta urbana importada en Miami" },
  { src: "/instagram/instagram-3.webp", alt: "Conjunto blanco Lacoste en Miami" },
  { src: "/instagram/instagram-4.webp", alt: "Cyber Day de Distrito Miami" },
  { src: "/instagram/instagram-5.webp", alt: "Conjunto rojo Guess en Miami" }
];

export function StorefrontClient({ products }: StorefrontClientProps) {
  const [cartLines, setCartLines] = useState<CartLine[]>([]);

  const categoryNav = useMemo(
    () =>
      categories
        .filter(
          (category): category is { id: ProductCategory; label: string } => category.id !== "all"
        )
        .map((category) => {
          const sizes = Array.from(
            new Set(
              products
                .filter((product) => product.category === category.id)
                .flatMap((product) => (shouldHideProductSizes(product) ? [] : product.sizes))
            )
          ).sort((a, b) => {
            const order = ["XS", "S", "M", "L", "XL", "U"];
            return order.indexOf(a) - order.indexOf(b);
          });

          return {
            ...category,
            href: `/?category=${category.id}#productos`,
            sizes
          };
        }),
    [products]
  );

  useEffect(() => {
    const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!storedCart) return;

    try {
      setCartLines(normalizeCartLines(JSON.parse(storedCart) as CartLine[]));
    } catch {
      setCartLines([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartLines));
  }, [cartLines]);

  function addToCart(productId: string, size: string) {
    setCartLines((current) => {
      const existing = current.find((line) => line.productId === productId && line.size === size);
      if (!existing) return [...current, { productId, size, quantity: 1 }];
      return current.map((line) =>
        line.productId === productId && line.size === size
          ? { ...line, quantity: line.quantity + 1 }
          : line
      );
    });
  }

  function removeFromCart(productId: string, size: string) {
    setCartLines((current) =>
      current.filter((line) => !(line.productId === productId && line.size === size))
    );
  }

  function showCategory(category: ProductCategory) {
    const nextUrl = `/?category=${category}#productos`;
    window.history.pushState(null, "", nextUrl);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cartQuantity = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <div className="storefront">
        <div className="topbar">Envios a todo Chile · Pago seguro con Flow</div>

        <section className="campaignHero">
          <img
            alt="Atardecer en Miami con moda urbana"
            className="campaignHeroImage"
            src="/distrito-miami-hero-v3-user.webp"
          />
          <div className="campaignShade" />

          <header className="campaignHeader">
            <nav className="campaignNav" aria-label="Navegacion principal">
              <div className="campaignNavLinks campaignNavLinksLeft">
                {categoryNav.slice(0, 3).map((category) => (
                  <div className="navItem" key={category.id}>
                    <a className="navCategory" href={category.href}>{category.label}</a>
                    <div className="navDropdown">
                      <a href={category.href}>Ver todo</a>
                      {category.sizes.map((size) => (
                        <a href={`/?category=${category.id}&size=${size}#productos`} key={size}>
                          {size === "U" ? "Sin talla" : `Talla ${size}`}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <a className="campaignLogo" href="/" aria-label="Distrito Miami, inicio">
                <img alt="Distrito Miami" src="/distrito-miami-logo.png" />
              </a>

              <div className="campaignNavRight">
                <div className="campaignNavLinks">
                  {categoryNav.slice(3).map((category) => (
                    <div className="navItem" key={category.id}>
                      <a className="navCategory" href={category.href}>{category.label}</a>
                      <div className="navDropdown">
                        <a href={category.href}>Ver todo</a>
                        {category.sizes.map((size) => (
                          <a href={`/?category=${category.id}&size=${size}#productos`} key={size}>
                            {size === "U" ? "Sin talla" : `Talla ${size}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <a className="campaignCartLink" href="/checkout">
                  Carrito <span>{cartQuantity}</span>
                </a>
              </div>
            </nav>
            <nav className="campaignMobileNav" aria-label="Categorias">
              {categoryNav.map((category) => (
                <a href={category.href} key={category.id}>{category.label}</a>
              ))}
            </nav>
          </header>

          <div className="campaignHeroCopy">
            <p className="campaignKicker">100% original</p>
            <h1>Exclusividad<br />que<br />cruza fronteras</h1>
            <p>Moda importada directamente desde Estados Unidos.<br />Diseños auténticos para quienes buscan algo distinto.</p>
            <div className="campaignActions">
              <a className="campaignPrimary" href="#categorias">Descubrir ahora <span>→</span></a>
            </div>
          </div>
        </section>

        <section className="campaignBenefits" aria-label="Beneficios">
          <div className="campaignPaymentBenefit">
            <strong>Pago seguro</strong>
            <span>Checkout protegido con WebPay</span>
            <img alt="WebPay Plus" className="campaignWebpayLogo" src="/webpay-plus.png" />
          </div>
          <div><strong>Stock actualizado</strong><span>Tallas disponibles por producto</span></div>
          <div className="campaignShippingBenefit">
            <strong>Despacho rapido</strong>
            <span>Envios a todo Chile</span>
            <span className="campaignShippingLogos" aria-label="Empresas de despacho">
              <img alt="Starken" src="/shipping/starken.webp" />
              <img alt="Chilexpress" src="/shipping/chilexpress.webp" />
              <img alt="CorreosChile" src="/shipping/correos-chile.webp" />
            </span>
          </div>
          <div><strong>Marcas originales</strong><span>Importadas desde Estados Unidos</span></div>
        </section>

        <section className="brandRail" aria-label="Marcas que importamos">
          <p>Marcas que importamos</p>
          <div>
            {importedBrands.map((brand) => (
              <span className="brandLogo" key={brand.name}>
                {brand.logo ? (
                  <img
                    alt={brand.name}
                    className={[
                      brand.inverted ? "brandLogoInverted" : "",
                      brand.larger ? "brandLogoLarger" : "",
                      brand.largest ? "brandLogoLargest" : ""
                    ].filter(Boolean).join(" ") || undefined}
                    src={brand.logo}
                  />
                ) : brand.name}
              </span>
            ))}
          </div>
        </section>

        <section className="instagramFeature" id="instagram" aria-label="Distrito Miami en Instagram">
          <div className="instagramFeatureInner">
            <div className="instagramFeatureHeader">
              <div className="instagramFeatureCopy">
                <div className="instagramEyebrow">
                  <img alt="" aria-hidden="true" src="/instagram/instagram-icon.webp" />
                  Síguenos en Instagram
                </div>
                <div className="instagramAccount">
                  <img
                    alt="Logo de Distrito Miami"
                    className="instagramProfileImage"
                    src="/instagram/profile-distrito-miami.webp"
                  />
                  <div className="instagramProfileMeta">
                    <h2>Distrito Miami</h2>
                    <small>3,023 publicaciones</small>
                  </div>
                </div>
                <p>Novedades, productos recién llegados y lanzamientos exclusivos.</p>
              </div>

              <a
                className="instagramButton"
                href="https://www.instagram.com/distritomiami"
                rel="noreferrer"
                target="_blank"
              >
                Seguir
              </a>
            </div>

            <div className="instagramGallery">
              {instagramGallery.map((image, index) => (
                <a
                  className="instagramPost"
                  href="https://www.instagram.com/distritomiami"
                  key={image.src}
                  rel="noreferrer"
                  target="_blank"
                  aria-label={`Ver publicación ${index + 1} en el Instagram de Distrito Miami`}
                >
                  <img alt={image.alt} src={image.src} />
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <main className="pageShell storefrontMain">
          <section className="categoryShowcase" id="categorias" aria-label="Comprar por categoria">
            {categoryNav.map((category) => {
              return (
                <article className="categoryFeature" key={category.id}>
                  <div className="categoryFeatureMedia">
                    <img
                      alt=""
                      aria-hidden="true"
                      className="categoryFeatureBackground"
                      src={categoryFeatureImages[category.id]}
                    />
                    <div className="categoryFeatureShade" />
                  </div>
                  <img
                    alt={`Moda de ${category.label}`}
                    className="categoryFeatureCutout"
                    src={categoryFeatureCutouts[category.id]}
                  />
                  <div className="categoryFeatureContent">
                    <h2>{category.label}</h2>
                    <a
                      href={category.href}
                      onClick={(event) => {
                        event.preventDefault();
                        showCategory(category.id);
                      }}
                    >
                      Ver todo
                    </a>
                  </div>
                </article>
              );
            })}
          </section>

          <ProductGrid onAdd={addToCart} products={products} />
        </main>
      </div>

      <CartDrawer lines={cartLines} onRemove={removeFromCart} products={products} />
    </>
  );
}

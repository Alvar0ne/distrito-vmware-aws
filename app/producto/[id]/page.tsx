import { notFound } from "next/navigation";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { shouldHideProductSizes } from "@/lib/productDisplay";
import { categories } from "@/lib/products";
import { formatCLP } from "@/lib/pricing";
import { readStoredProducts } from "@/lib/productStore";

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const products = await readStoredProducts();
  const product = products.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  const categoryLabel = categories.find((category) => category.id === product.category)?.label;
  const hideSizes = shouldHideProductSizes(product);
  const relatedProducts = products
    .filter((item) => item.id !== product.id && item.category === product.category)
    .slice(0, 4);
  const categoryNav = categories.filter((category) => category.id !== "all");
  const isOnSale = Boolean(product.compareAtPrice && product.compareAtPrice > product.price);
  const totalStock = Object.values(product.stockBySize).reduce((sum, stock) => sum + stock, 0);

  return (
    <div className="productStorefront">
      <div className="productTopbar">Envios a todo Chile · Pago seguro con WebPay</div>
      <header className="productCampaignHeader">
        <nav className="productCampaignNav" aria-label="Navegacion de productos">
          <a className="productCampaignLogo" href="/" aria-label="Distrito Miami, inicio">
            <img alt="Distrito Miami" src="/distrito-miami-logo.png" />
          </a>
          <div className="productCampaignLinks">
            {categoryNav.map((category) => (
              <a href={`/?category=${category.id}#productos`} key={category.id}>
                {category.label}
              </a>
            ))}
          </div>
          <a className="productHeaderCart" href="/checkout">Carrito</a>
        </nav>
      </header>

      <main className="productPage">
        <nav className="productBreadcrumb" aria-label="Ruta del producto">
          <a href="/">Inicio</a><span>/</span>
          <a href={`/?category=${product.category}#productos`}>{categoryLabel}</a><span>/</span>
          <strong>{product.name}</strong>
        </nav>

        <section className="productDetail">
          <div className="productGallery">
            {(product.images.length ? product.images : ["/placeholder-product.jpg"]).map((image, index) => (
              <figure className={index === 0 ? "mainProductImage" : ""} key={image}>
                <img src={image} alt={`${product.name} ${index + 1}`} />
                {index === 0 && isOnSale ? (
                  <img alt="Oferta especial" className="productDetailSaleBadge" src="/oferta-especial.png" />
                ) : null}
              </figure>
            ))}
          </div>

          <div className="productInfo">
            <div className="productInfoHeading">
              <p className="eyebrow">{product.brand}</p>
              <span>{categoryLabel}</span>
            </div>
            <h1>{product.name}</h1>

            <div className="priceBlock">
              {isOnSale ? (
                <span>{formatCLP(product.compareAtPrice ?? 0)}</span>
              ) : null}
              <strong>{formatCLP(product.price)}</strong>
            </div>

            <p className="productDescription">{product.description}</p>

            <ProductPurchasePanel
              hideSizes={hideSizes}
              productId={product.id}
              sizes={product.sizes}
              stockBySize={product.stockBySize}
            />

            <div className="productTrustRow">
              <span><strong>Pago seguro</strong>WebPay</span>
              <span><strong>Despacho</strong>Todo Chile</span>
              <span><strong>Stock</strong>{totalStock} disponible(s)</span>
            </div>

            <div className="detailBlock">
              <h2>Datos del producto</h2>
              <dl className="productFacts">
                <div>
                  <dt>Categoria</dt>
                  <dd>{categoryLabel}</dd>
                </div>
                <div>
                  <dt>Marca</dt>
                  <dd>{product.brand}</dd>
                </div>
                <div>
                  <dt>Stock total</dt>
                  <dd>{totalStock}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {relatedProducts.length ? (
          <section className="relatedProducts">
            <div className="sectionHead">
              <div>
                <p className="eyebrow">Tambien te puede gustar</p>
                <h2>Mas en {categoryLabel}</h2>
              </div>
            </div>
            <div className="relatedGrid">
              {relatedProducts.map((related) => (
                <a className="relatedCard" href={`/producto/${related.id}`} key={related.id}>
                  <figure><img src={related.images[0] ?? "/placeholder-product.jpg"} alt={related.name} /></figure>
                  <span>{related.brand}</span>
                  <strong>{related.name}</strong>
                  <div className="relatedPrice">
                    {related.compareAtPrice && related.compareAtPrice > related.price ? (
                      <del>{formatCLP(related.compareAtPrice)}</del>
                    ) : null}
                    <em>{formatCLP(related.price)}</em>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

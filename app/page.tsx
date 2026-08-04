import { StorefrontClient } from "@/components/StorefrontClient";
import { readStoredProducts } from "@/lib/productStore";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await readStoredProducts();

  return <StorefrontClient products={products} />;
}

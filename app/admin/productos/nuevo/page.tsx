import { AdminShell } from "@/components/AdminShell";
import { AdminProductEditForm } from "@/components/AdminProductEditForm";
import { readOrders } from "@/lib/orderStore";
import { readStoredProducts, type StoredProduct } from "@/lib/productStore";

export const dynamic = "force-dynamic";

const draftProduct: StoredProduct = {
  id: "nuevo-producto",
  name: "Nuevo producto",
  brand: "",
  category: "poleras",
  price: 0,
  images: [],
  sizes: [],
  stockBySize: {},
  featured: false,
  description: ""
};

export default async function NewProductPage() {
  const [orders, products] = await Promise.all([readOrders(), readStoredProducts()]);

  return (
    <AdminShell
      counts={{
        orders: orders.length,
        products: products.length
      }}
      currentSection="productos"
    >
      <AdminProductEditForm mode="create" product={draftProduct} />
    </AdminShell>
  );
}

import { AdminShell } from "@/components/AdminShell";
import { AdminProductEditForm } from "@/components/AdminProductEditForm";
import { readOrders } from "@/lib/orderStore";
import { readStoredProductById, readStoredProducts } from "@/lib/productStore";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type ProductEditPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProductEditPage({ params }: ProductEditPageProps) {
  const { id } = await params;
  const product = await readStoredProductById(id);
  const [orders, products] = await Promise.all([readOrders(), readStoredProducts()]);

  if (!product) {
    notFound();
  }

  return (
    <AdminShell
      counts={{
        orders: orders.length,
        products: products.length
      }}
      currentSection="productos"
    >
      <div className="adminEditShell">
        <AdminProductEditForm product={product} />
      </div>
    </AdminShell>
  );
}

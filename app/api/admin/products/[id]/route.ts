import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteStoredProduct, updateStoredProduct } from "@/lib/productStore";

const imagePathSchema = z.string().trim().refine(
  (value) => {
    if (value.startsWith("/")) return true;

    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "Ingresa rutas de foto validas." }
);

const productUpdateSchema = z.object({
  name: z.string().trim().min(1, "Ingresa el nombre del producto."),
  brand: z.string().trim(),
  category: z.enum(["poleras", "polerones", "chaquetas", "accesorios", "conjuntos"]),
  description: z.string().trim(),
  price: z.number().int().nonnegative("Ingresa un precio valido."),
  compareAtPrice: z.number().int().nonnegative().nullable().optional(),
  featured: z.boolean(),
  images: z.array(imagePathSchema).default([]),
  sizes: z
    .array(z.enum(["XS", "S", "M", "L", "XL", "XXL", "U"]))
    .min(1, "Ingresa al menos una talla."),
  stockBySize: z.record(z.string(), z.number().int().nonnegative()).default({})
});

type ProductRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, { params }: ProductRouteProps) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = productUpdateSchema.parse(body);
    const updated = await updateStoredProduct(id, {
      ...input,
      compareAtPrice: input.compareAtPrice ?? undefined
    });

    if (!updated) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ product: updated });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Revisa los datos del producto."
        : "No se pudo guardar el producto.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: ProductRouteProps) {
  try {
    const { id } = await params;
    const deleted = await deleteStoredProduct(id);

    if (!deleted) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const databaseCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    const message =
      databaseCode === "23503"
        ? "Este producto pertenece a un pedido y no puede eliminarse."
        : "No se pudo eliminar el producto.";

    return NextResponse.json({ error: message }, { status: databaseCode === "23503" ? 409 : 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createStoredProduct } from "@/lib/productStore";

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

const productCreateSchema = z.object({
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = productCreateSchema.parse(body);
    const product = await createStoredProduct({
      ...input,
      compareAtPrice: input.compareAtPrice ?? undefined
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Revisa los datos del producto."
        : "No se pudo crear el producto.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

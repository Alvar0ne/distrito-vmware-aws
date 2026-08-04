import { NextResponse } from "next/server";
import { saveProductImage } from "@/lib/imageStorage";
import { readStoredProductById } from "@/lib/productStore";

type ProductImageRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: ProductImageRouteProps) {
  try {
    const { id } = await params;
    const product = await readStoredProductById(id);

    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecciona una imagen valida." }, { status: 400 });
    }

    const image = await saveProductImage(file, product.id);

    return NextResponse.json({
      image
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo subir la imagen." },
      { status: 400 }
    );
  }
}

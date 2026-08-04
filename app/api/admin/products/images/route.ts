import { NextResponse } from "next/server";
import { saveProductImage } from "@/lib/imageStorage";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const productName = String(formData.get("productName") ?? "nuevo-producto");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Selecciona una imagen valida." }, { status: 400 });
    }

    const image = await saveProductImage(file, productName);

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

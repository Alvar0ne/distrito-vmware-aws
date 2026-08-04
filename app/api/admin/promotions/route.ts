import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { deletePromotion, readPromotions, savePromotion } from "@/lib/promotionStore";

const promotionSchema = z.object({
  code: z.string().trim().min(2, "Ingresa un codigo de al menos 2 caracteres."),
  description: z.string().default(""),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().int().positive("El descuento debe ser mayor a cero."),
  active: z.boolean().default(true)
});

export async function GET() {
  return NextResponse.json({ promotions: await readPromotions() });
}

export async function POST(request: Request) {
  try {
    const payload = promotionSchema.parse(await request.json());
    const promotion = await savePromotion(payload);
    return NextResponse.json({ promotion });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? error.issues[0]?.message ?? "Revisa los datos del codigo."
        : error instanceof Error
          ? error.message
          : "No se pudo guardar la promocion.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el codigo a eliminar." }, { status: 400 });
  }

  const deleted = await deletePromotion(id);
  return NextResponse.json({ deleted });
}

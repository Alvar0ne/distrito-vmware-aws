import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateCheckoutTotals, SHIPPING_METHODS } from "@/lib/pricing";
import { readStoredProducts } from "@/lib/productStore";
import { findActivePromotionByCode } from "@/lib/promotionStore";

const applyPromotionSchema = z.object({
  code: z.string().min(1),
  shippingRegion: z.string().default(""),
  shippingMethod: z.enum([SHIPPING_METHODS.HOME, SHIPPING_METHODS.STARKEN]),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        size: z.string(),
        quantity: z.number().int().positive()
      })
    )
    .min(1)
});

export async function POST(request: Request) {
  const payload = applyPromotionSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Ingresa un codigo valido." }, { status: 400 });
  }

  const [products, promotion] = await Promise.all([
    readStoredProducts(),
    findActivePromotionByCode(payload.data.code)
  ]);

  if (!promotion) {
    return NextResponse.json({ error: "Codigo invalido o inactivo." }, { status: 404 });
  }

  const totals = calculateCheckoutTotals(
    payload.data.lines,
    products,
    payload.data.shippingRegion,
    payload.data.shippingMethod,
    {
      code: promotion.code,
      type: promotion.type,
      value: promotion.value
    }
  );

  return NextResponse.json({
    promotion: {
      code: promotion.code,
      type: promotion.type,
      value: promotion.value,
      description: promotion.description
    },
    totals
  });
}

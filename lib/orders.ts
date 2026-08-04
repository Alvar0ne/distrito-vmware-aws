import { z } from "zod";
import { CHILE_REGIONS, getCommunesForRegion } from "./chileLocations";
import { calculateCheckoutTotals, SHIPPING_METHODS } from "./pricing";
import type { Product } from "./products";
import type { Promotion } from "./promotionStore";
import { normalizePromotionCode } from "./promotionStore";
import { isValidRutFormat } from "./rut";

function isValidPhone(value: string) {
  if (/[A-Za-z]/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 12;
}

export const checkoutInputSchema = z.object({
  customerName: z.string().min(2),
  customerRut: z.string().min(8).refine(isValidRutFormat, "RUT invalido"),
  customerEmail: z.string().email(),
  customerPhone: z.string().refine(isValidPhone, "Telefono invalido"),
  shippingRegion: z.string().min(2).refine(
    (region) => CHILE_REGIONS.some((item) => item.name === region),
    "Region invalida"
  ),
  shippingCommune: z.string().min(2),
  shippingMethod: z.enum([SHIPPING_METHODS.HOME, SHIPPING_METHODS.STARKEN]),
  shippingAddress: z.string().min(3),
  notes: z.string().optional(),
  promotionCode: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        size: z.string(),
        quantity: z.number().int().positive()
      })
    )
    .min(1)
}).refine(
  (input) => getCommunesForRegion(input.shippingRegion).includes(input.shippingCommune),
  {
    message: "La comuna no corresponde a la region seleccionada",
    path: ["shippingCommune"]
  }
).refine(
  (input) =>
    input.shippingMethod === SHIPPING_METHODS.STARKEN || input.shippingAddress.trim().length >= 8,
  {
    message: "Direccion invalida",
    path: ["shippingAddress"]
  }
);

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

function createOrderId() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `DM-${digits}`;
}

export function buildOrder(input: CheckoutInput, products: Product[], promotions: Promotion[] = []) {
  const parsed = checkoutInputSchema.parse(input);
  const promotionCode = normalizePromotionCode(parsed.promotionCode ?? "");
  const promotion = promotionCode
    ? promotions.find((item) => item.active && item.code === promotionCode)
    : null;

  if (promotionCode && !promotion) {
    throw new Error("Codigo de descuento invalido o inactivo.");
  }

  const totals = calculateCheckoutTotals(
    parsed.lines,
    products,
    parsed.shippingRegion,
    parsed.shippingMethod,
    promotion
      ? {
          code: promotion.code,
          type: promotion.type,
          value: promotion.value
        }
      : null
  );
  const orderId = createOrderId();

  const items = parsed.lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) {
      throw new Error(`Product not found: ${line.productId}`);
    }

    return {
      productId: product.id,
      productName: product.name,
      imageUrl: product.images[0] ?? "",
      size: line.size,
      quantity: line.quantity,
      unitPrice: product.price,
      lineTotal: product.price * line.quantity
    };
  });

  return {
    id: orderId,
    customer: {
      name: parsed.customerName,
      rut: parsed.customerRut,
      email: parsed.customerEmail,
      phone: parsed.customerPhone,
      region: parsed.shippingRegion,
      commune: parsed.shippingCommune,
      shippingMethod: parsed.shippingMethod,
      shippingAddress: parsed.shippingAddress,
      notes: parsed.notes ?? ""
    },
    items,
    totals,
    promotionCode: promotion?.code ?? "",
    paymentStatus: "pending" as const,
    fulfillmentStatus: "received" as const
  };
}

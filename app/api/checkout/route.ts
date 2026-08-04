import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createFlowPayment } from "@/lib/flow";
import { attachOrderPayment, saveOrder } from "@/lib/orderStore";
import { buildOrder, checkoutInputSchema } from "@/lib/orders";
import { readStoredProducts } from "@/lib/productStore";
import { readPromotions } from "@/lib/promotionStore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = checkoutInputSchema.parse(body);
    const [products, promotions] = await Promise.all([readStoredProducts(), readPromotions()]);
    const order = buildOrder(input, products, promotions);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const payment = await createFlowPayment({
      orderId: order.id,
      subject: `Compra Distrito Miami ${order.id}`,
      amount: order.totals.total,
      email: order.customer.email,
      returnUrl: `${siteUrl}/checkout/retorno?order=${encodeURIComponent(order.id)}`,
      confirmationUrl: `${siteUrl}/api/flow/confirmacion`
    });
    const storedOrder = await saveOrder(order);
    const orderWithPayment = await attachOrderPayment(storedOrder.id, {
      provider: payment.provider,
      token: payment.token,
      url: payment.url,
      flowOrder: payment.flowOrder
    });
    const finalOrder = orderWithPayment ?? storedOrder;

    return NextResponse.json({
      order: finalOrder,
      payment
    });
  } catch (error) {
    const fieldErrors =
      error instanceof ZodError
        ? error.issues.reduce<Record<string, string>>((errors, issue) => {
            const field = String(issue.path[0] ?? "form");
            errors[field] = issue.message;
            return errors;
          }, {})
        : undefined;

    return NextResponse.json(
      {
        error:
          error instanceof ZodError
            ? "Revisa los campos marcados en rojo."
            : error instanceof Error
              ? error.message
              : "Revisa los campos marcados en rojo.",
        fieldErrors
      },
      { status: 400 }
    );
  }
}

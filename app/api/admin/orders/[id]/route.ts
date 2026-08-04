import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteOrder, readOrders, updateOrderStatus } from "@/lib/orderStore";
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES } from "@/lib/orderTypes";

const orderStatusSchema = z.object({
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES).optional()
});

type OrderRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: OrderRouteProps) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = orderStatusSchema.parse(body);
    const existing = (await readOrders()).find((order) => order.id === id);

    if (input.paymentStatus && existing?.payment?.provider === "flow") {
      return NextResponse.json(
        { error: "El estado de pago Flow se actualiza automaticamente." },
        { status: 400 }
      );
    }

    const updated = await updateOrderStatus(id, input);

    if (!updated) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Selecciona un estado valido."
        : "No se pudo actualizar el pedido.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: OrderRouteProps) {
  try {
    const { id } = await params;
    const deleted = await deleteOrder(id);

    if (!deleted) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar el pedido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

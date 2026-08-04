import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getBrevoStatus, sendBrevoTestEmail, syncCustomersToBrevo } from "@/lib/brevo";
import { readCustomers } from "@/lib/customerStore";
import { sendPaidOrderEmail } from "@/lib/email";
import { readOrders } from "@/lib/orderStore";

const brevoActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("syncContacts") }),
  z.object({ action: z.literal("sendTest"), email: z.string().email() }),
  z.object({ action: z.literal("sendPaidOrderTest"), email: z.string().email() })
]);

export async function GET() {
  return NextResponse.json({ status: getBrevoStatus() });
}

export async function POST(request: Request) {
  try {
    const input = brevoActionSchema.parse(await request.json());

    if (input.action === "syncContacts") {
      const customers = await readCustomers();
      const result = await syncCustomersToBrevo(customers);
      return NextResponse.json({ result });
    }

    if (input.action === "sendTest") {
      const result = await sendBrevoTestEmail(input.email);
      return NextResponse.json({ sent: true, result });
    }
 
    const orders = await readOrders();
    const order = orders[0];
    if (!order) {
      return NextResponse.json({ error: "No hay pedidos para probar el correo." }, { status: 400 });
    }

    const result = await sendPaidOrderEmail(
      { ...order, paymentStatus: "paid" },
      {
        requireBrevo: true,
        overrideRecipientEmail: input.email,
        overrideRecipientName: "Prueba Distrito Miami",
        subjectSuffix: `[prueba ${new Date().toLocaleTimeString("es-CL")}]`
      }
    );
    return NextResponse.json({ sent: true, result, to: input.email });
  } catch (error) {
    const message =
      error instanceof ZodError
        ? "Revisa los datos enviados a Brevo."
        : error instanceof Error
          ? error.message
          : "No se pudo ejecutar la accion de Brevo.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

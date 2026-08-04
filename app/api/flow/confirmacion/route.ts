import { NextResponse } from "next/server";
import { sendPaidOrderEmail } from "@/lib/email";
import { getFlowPaymentStatus, isFlowPaymentPaid } from "@/lib/flow";
import { claimPaidOrderEmail, updateOrderPaymentStatusByToken, updateOrderStatus } from "@/lib/orderStore";

async function confirmFlowToken(token: string) {
  const flowStatus = await getFlowPaymentStatus(token);
  const paymentStatus = isFlowPaymentPaid(flowStatus.status) ? "paid" : "pending";
  const order =
    (await updateOrderPaymentStatusByToken(token, paymentStatus)) ??
    (flowStatus.commerceOrder
      ? await updateOrderStatus(flowStatus.commerceOrder, { paymentStatus })
      : null);

  if (paymentStatus === "paid" && order && (await claimPaidOrderEmail(order.id))) {
    try {
      await sendPaidOrderEmail(order);
    } catch (emailError) {
      console.error("paid-order-email-error", emailError);
    }
  }

  return { flowStatus, paymentStatus, order };
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const token = contentType.includes("application/json")
      ? String(((await request.json().catch(() => null)) as { token?: string } | null)?.token ?? "")
      : String((await request.formData()).get("token") ?? "");

    if (!token) {
      console.error("flow-confirmation-missing-token");
      return new NextResponse("OK", { status: 200 });
    }

    await confirmFlowToken(token);
  } catch (error) {
    console.error("flow-confirmation-error", error);
  }

  return new NextResponse("OK", { status: 200 });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ ok: false, error: "Token no recibido." }, { status: 400 });
  }

  try {
    const result = await confirmFlowToken(token);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("flow-status-error", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo confirmar el estado del pago." },
      { status: 500 }
    );
  }
}

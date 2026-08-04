import { getFlowPaymentStatus, isFlowPaymentPaid } from "@/lib/flow";
import {
  claimPaidOrderEmail,
  readOrders,
  updateOrderPaymentStatusByToken,
  updateOrderStatus
} from "@/lib/orderStore";
import { sendPaidOrderEmail } from "@/lib/email";
import { formatCLP } from "@/lib/pricing";
import { ClearPaidCart } from "@/components/ClearPaidCart";
import { RefreshPendingPayment } from "@/components/RefreshPendingPayment";
import type { StoredOrder } from "@/lib/orderTypes";

type CheckoutReturnPageProps = {
  searchParams: Promise<{
    commerceOrder?: string;
    order?: string;
    token?: string;
  }>;
};

export default async function CheckoutReturnPage({ searchParams }: CheckoutReturnPageProps) {
  const params = await searchParams;
  const token = params.token ?? "";
  const orderId = params.order ?? params.commerceOrder ?? "";
  let title = "Estamos revisando tu pago";
  let copy =
    "Si el pago fue aprobado, te llegara un correo de confirmacion. Si tienes alguna duda, puedes escribirnos a nuestro Instagram para verificar el pedido.";
  let paidOrder: StoredOrder | null = null;
  let lookupToken = token;
  let existingOrder: StoredOrder | null = null;

  if (orderId) {
    existingOrder = (await readOrders()).find((order) => order.id === orderId) ?? null;
    lookupToken = lookupToken || existingOrder?.payment?.token || "";
  }

  if (lookupToken) {
    try {
      const flowStatus = await getFlowPaymentStatus(lookupToken);
      const paymentStatus = isFlowPaymentPaid(flowStatus.status) ? "paid" : "pending";
      const order =
        (await updateOrderPaymentStatusByToken(lookupToken, paymentStatus)) ??
        (flowStatus.commerceOrder
          ? await updateOrderStatus(flowStatus.commerceOrder, { paymentStatus })
          : orderId
            ? await updateOrderStatus(orderId, { paymentStatus })
          : null);

      if (paymentStatus === "paid") {
        title = "Pago confirmado";
        copy =
          "Tu pago fue aprobado correctamente. Ya recibimos tu pedido y te enviaremos la confirmacion por correo.";
        paidOrder = order;

        if (order && (await claimPaidOrderEmail(order.id))) {
          try {
            await sendPaidOrderEmail(order);
          } catch (emailError) {
            console.error("paid-order-email-return-error", emailError);
          }
        }
      }
    } catch (error) {
      console.error("checkout-return-flow-error", error);
    }
  } else if (existingOrder?.paymentStatus === "paid") {
    title = "Pago confirmado";
    copy =
      "Tu pago fue aprobado correctamente. Ya recibimos tu pedido y te enviaremos la confirmacion por correo.";
    paidOrder = existingOrder;
  }

  return (
    <main className="checkoutShell">
      <ClearPaidCart active={Boolean(paidOrder)} />
      <RefreshPendingPayment active={Boolean((lookupToken || orderId) && !paidOrder)} />
      <section className="checkoutCard">
        <p className="eyebrow">Pago</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        {paidOrder ? (
          <div className="paidConfirmation">
            <div className="paidConfirmationHead">
              <span>Pedido</span>
              <strong>{paidOrder.id}</strong>
            </div>
            <div className="paidConfirmationItems">
              {paidOrder.items.map((item) => (
                <article key={`${item.productId}-${item.size}`} className="paidConfirmationItem">
                  <img
                    alt={item.productName}
                    src={item.imageUrl || "/placeholder-product.jpg"}
                  />
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      {item.size === "U" ? "Unidad" : `Talla ${item.size}`} ·{" "}
                      {item.quantity} unidad{item.quantity === 1 ? "" : "es"}
                    </span>
                  </div>
                  <b>{formatCLP(item.lineTotal)}</b>
                </article>
              ))}
            </div>
            <dl className="paidConfirmationTotals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCLP(paidOrder.totals.subtotal)}</dd>
              </div>
              {paidOrder.totals.discount > 0 ? (
                <div>
                  <dt>Descuento</dt>
                  <dd>-{formatCLP(paidOrder.totals.discount)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Envio</dt>
                <dd>
                  {paidOrder.totals.shipping ? formatCLP(paidOrder.totals.shipping) : "Por pagar"}
                </dd>
              </div>
              <div>
                <dt>Total pagado</dt>
                <dd>{formatCLP(paidOrder.totals.total)}</dd>
              </div>
            </dl>
            <p className="paidConfirmationHelp">
              Cualquier consulta, escribenos por Instagram:{" "}
              <a href="https://www.instagram.com/distritomiami" rel="noreferrer" target="_blank">
                @distritomiami
              </a>
            </p>
          </div>
        ) : null}
        <a className="checkoutButton" href="/">
          Volver a la tienda
        </a>
      </section>
    </main>
  );
}

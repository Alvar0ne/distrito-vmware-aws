import { promises as fs } from "node:fs";
import path from "node:path";
import type { StoredOrder } from "./orderTypes";
import { formatCLP } from "./pricing";

type OutboxEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  createdAt: string;
  provider: "local" | "brevo";
};

const outboxPath = path.join(process.cwd(), "data", "email-outbox.local.json");

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

function isLocalSiteUrl(url: string) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url);
}

function getPublicImageUrl(imageUrl?: string) {
  const siteUrl = getSiteUrl();
  if (!imageUrl || isLocalSiteUrl(siteUrl)) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${siteUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

function getItemsText(order: StoredOrder) {
  return order.items
    .map((item) => {
      const size = item.size === "U" ? "" : `, talla ${item.size}`;
      return `- ${item.productName}${size} x${item.quantity}: ${formatCLP(item.lineTotal)}`;
    })
    .join("\n");
}

function buildPaidOrderEmail(order: StoredOrder) {
  const subject = `Pago confirmado ${order.id} - Distrito Miami`;
  const itemsText = getItemsText(order);
  const shipping =
    order.totals.shipping > 0 ? formatCLP(order.totals.shipping) : "Por pagar / sin cobro online";
  const siteUrl = getSiteUrl();
  const instagramUrl = "https://www.instagram.com/distritomiami";
  const logoHtml = isLocalSiteUrl(siteUrl)
    ? `
      <div style="display:inline-block;background:#111;color:#fff;border-radius:999px;padding:12px 18px;font-size:18px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">
        Distrito Miami
      </div>
    `
    : `
      <img src="${siteUrl}/distrito-miami-logo.png" alt="Distrito Miami" width="92" style="display:inline-block;width:92px;max-width:92px;height:auto;border:0;vertical-align:middle;" />
    `;
  const customerName = escapeHtml(order.customer.name);
  const orderId = escapeHtml(order.id);
  const shippingMethod =
    order.customer.shippingMethod === "starken" ? "Sucursal de Starken" : "Envio a domicilio";
  const shippingTitle =
    order.customer.shippingMethod === "starken" ? "Sucursal destino" : "Direccion de envio";
  const shippingAddress = escapeHtml(order.customer.shippingAddress || "Por confirmar");
  const shippingPlace = [order.customer.commune, order.customer.region].filter(Boolean).join(", ");

  const text = [
    `Hola ${order.customer.name},`,
    "",
    "Tu pago fue confirmado correctamente en Distrito Miami.",
    "",
    `Pedido: ${order.id}`,
    itemsText,
    "",
    `Subtotal: ${formatCLP(order.totals.subtotal)}`,
    `Descuento: ${formatCLP(order.totals.discount)}`,
    `Envio: ${shipping}`,
    `Total: ${formatCLP(order.totals.total)}`,
    "",
    "Ya estamos preparando tu pedido. Te avisaremos cuando avance el despacho.",
    "Cualquier consulta, comunicate con nosotros por Instagram:",
    instagramUrl,
    "",
    "Distrito Miami"
  ].join("\n");

  const rows = order.items
    .map((item) => {
      const imageUrl = getPublicImageUrl(item.imageUrl);
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee7dd;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td width="52" style="padding-right:12px;vertical-align:top;">
                  ${
                    imageUrl
                      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.productName)}" width="46" height="46" style="display:block;width:46px;height:46px;object-fit:cover;border-radius:12px;border:0;background:#eee7dd;" />`
                      : `<div style="width:46px;height:46px;border-radius:12px;background:#111;color:#fff;font-size:18px;font-weight:800;line-height:46px;text-align:center;">
                    ${escapeHtml(item.productName.slice(0, 1).toUpperCase())}
                  </div>`
                  }
                </td>
                <td style="vertical-align:top;">
                  <strong style="display:block;color:#151515;font-size:15px;line-height:1.25;">${escapeHtml(item.productName)}</strong>
                  <span style="display:block;margin-top:4px;color:#77706a;font-size:13px;">
                    ${item.size === "U" ? "Sin talla" : `Talla ${escapeHtml(item.size)}`} · ${item.quantity} unidad(es)
                  </span>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eee7dd;text-align:right;color:#151515;font-size:15px;font-weight:800;white-space:nowrap;">
            ${escapeHtml(formatCLP(item.lineTotal))}
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#151515;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ec;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 14px;text-align:center;">
                    ${logoHtml}
                  </td>
                </tr>

                <tr>
                  <td style="background:#111;border-radius:18px 18px 0 0;padding:28px 26px;color:#fff;text-align:left;">
                    <div style="display:inline-block;margin-bottom:14px;border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:7px 12px;color:#c9f0d8;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">
                      Pago confirmado
                    </div>
                    <h1 style="margin:0;color:#fff;font-size:34px;line-height:1.05;font-weight:900;letter-spacing:0;">
                      Gracias por tu compra
                    </h1>
                    <p style="margin:12px 0 0;color:#d8d3cc;font-size:16px;line-height:1.55;">
                      Hola ${customerName}, tu pago fue confirmado correctamente y ya estamos preparando tu pedido.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background:#fff;border:1px solid #e6ded2;border-top:0;border-radius:0 0 18px 18px;overflow:hidden;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:22px 26px;border-bottom:1px solid #eee7dd;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="vertical-align:top;">
                                <span style="display:block;color:#77706a;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Pedido</span>
                                <strong style="display:block;margin-top:5px;color:#151515;font-size:18px;">${orderId}</strong>
                              </td>
                              <td align="right" style="vertical-align:top;">
                                <span style="display:inline-block;border-radius:999px;background:#eaf8f0;color:#087744;padding:9px 12px;font-size:12px;font-weight:900;">
                                  Pagado
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:22px 26px;">
                          <h2 style="margin:0 0 12px;color:#151515;font-size:18px;line-height:1.2;">Resumen del pedido</h2>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            ${rows}
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:0 26px 22px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#faf8f5;border:1px solid #eee7dd;border-radius:14px;">
                            <tr>
                              <td style="padding:16px 18px;color:#77706a;font-size:14px;">Subtotal</td>
                              <td align="right" style="padding:16px 18px;color:#151515;font-size:14px;font-weight:800;">${escapeHtml(formatCLP(order.totals.subtotal))}</td>
                            </tr>
                            <tr>
                              <td style="padding:0 18px 16px;color:#77706a;font-size:14px;">Descuento</td>
                              <td align="right" style="padding:0 18px 16px;color:#151515;font-size:14px;font-weight:800;">${escapeHtml(formatCLP(order.totals.discount))}</td>
                            </tr>
                            <tr>
                              <td style="padding:0 18px 16px;color:#77706a;font-size:14px;">Envio</td>
                              <td align="right" style="padding:0 18px 16px;color:#151515;font-size:14px;font-weight:800;">${escapeHtml(shipping)}</td>
                            </tr>
                            <tr>
                              <td style="padding:16px 18px;border-top:1px solid #eee7dd;color:#151515;font-size:18px;font-weight:900;">Total pagado</td>
                              <td align="right" style="padding:16px 18px;border-top:1px solid #eee7dd;color:#c6242b;font-size:24px;font-weight:900;">${escapeHtml(formatCLP(order.totals.total))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:0 26px 24px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="padding:16px 0;border-top:1px solid #eee7dd;">
                                <h3 style="margin:0 0 8px;color:#151515;font-size:16px;">${shippingTitle}</h3>
                                <p style="margin:0;color:#625b55;font-size:14px;line-height:1.5;">
                                  ${escapeHtml(shippingMethod)}<br />
                                  ${shippingAddress}<br />
                                  ${escapeHtml(shippingPlace)}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:22px 26px;background:#111;color:#fff;border-radius:0 0 16px 16px;">
                          <p style="margin:0;color:#f3efe8;font-size:15px;line-height:1.55;">
                            Te avisaremos cuando el pedido avance en preparacion o despacho. Gracias por elegir moda importada 100% original.
                          </p>
                          <p style="margin:18px 0 0;">
                            <a href="${siteUrl}" style="display:inline-block;background:#fff;color:#111;text-decoration:none;border-radius:8px;padding:12px 16px;font-weight:900;font-size:13px;">
                              Volver a la tienda
                            </a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 12px 0;text-align:center;color:#8a837c;font-size:12px;line-height:1.45;">
                    Distrito Miami Importaciones<br />
                    Este correo confirma el pago de tu pedido.<br />
                    Cualquier consulta, comunicate con nosotros por Instagram:<br />
                    <a href="${instagramUrl}" style="color:#c6242b;text-decoration:none;font-weight:800;">@distritomiami</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, text, html };
}

async function saveLocalOutbox(email: OutboxEmail) {
  try {
    await fs.access(outboxPath);
  } catch {
    await fs.mkdir(path.dirname(outboxPath), { recursive: true });
    await fs.writeFile(outboxPath, "[]", "utf8");
  }

  const raw = await fs.readFile(outboxPath, "utf8");
  const emails = JSON.parse(raw) as OutboxEmail[];
  emails.unshift(email);
  await fs.writeFile(outboxPath, JSON.stringify(emails, null, 2), "utf8");
}

type SendPaidOrderEmailOptions = {
  requireBrevo?: boolean;
  overrideRecipientEmail?: string;
  overrideRecipientName?: string;
  subjectSuffix?: string;
};

export async function sendPaidOrderEmail(
  order: StoredOrder,
  options: SendPaidOrderEmailOptions = {}
) {
  const email = buildPaidOrderEmail(order);
  const recipientEmail = options.overrideRecipientEmail ?? order.customer.email;
  const recipientName = options.overrideRecipientName ?? order.customer.name;
  const subject = options.subjectSuffix
    ? `${email.subject} ${options.subjectSuffix}`
    : email.subject;
  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Distrito Miami";

  if (brevoApiKey && senderEmail) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: senderName
        },
        to: [{ email: recipientEmail, name: recipientName }],
        subject,
        htmlContent: email.html,
        textContent: email.text
      })
    });

    const data = await response.json().catch(() => ({} as { message?: string; messageId?: string }));

    if (!response.ok) {
      throw new Error(data.message || "No se pudo enviar el correo de confirmacion.");
    }

    return {
      provider: "brevo" as const,
      messageId: data.messageId ?? ""
    };
  }

  if (options.requireBrevo) {
    throw new Error("Brevo no esta configurado. Falta BREVO_API_KEY y BREVO_SENDER_EMAIL en .env.");
  }

  await saveLocalOutbox({
    to: recipientEmail,
    subject,
    html: email.html,
    text: email.text,
    createdAt: new Date().toISOString(),
    provider: "local"
  });

  return {
    provider: "local" as const,
    messageId: ""
  };
}

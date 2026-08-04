import type { StoredCustomer } from "./customerStore";

const BREVO_API_BASE = "https://api.brevo.com/v3";

type BrevoSyncResult = {
  createdOrUpdated: number;
  failed: number;
  errors: string[];
};

function getBrevoApiKey() {
  return process.env.BREVO_API_KEY?.trim() ?? "";
}

function getBrevoListId() {
  const value = process.env.BREVO_LIST_ID?.trim();
  return value ? Number(value) : null;
}

export function getBrevoStatus() {
  const apiKey = getBrevoApiKey();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() ?? "";
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Distrito Miami";
  const listId = getBrevoListId();

  return {
    connected: Boolean(apiKey),
    hasSender: Boolean(senderEmail),
    listId,
    senderEmail,
    senderName
  };
}

function getCustomerAttributes(customer: StoredCustomer) {
  return {
    FIRSTNAME: customer.name,
    RUT: customer.rut,
    PHONE: customer.phone,
    REGION: customer.region,
    COMMUNE: customer.commune,
    ADDRESS: customer.shippingAddress,
    ORDERS: customer.orderCount
  };
}

export async function syncCustomersToBrevo(customers: StoredCustomer[]): Promise<BrevoSyncResult> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) throw new Error("Falta BREVO_API_KEY en el archivo .env.");

  const listId = getBrevoListId();
  const validCustomers = customers.filter((customer) => customer.email.includes("@"));
  const result: BrevoSyncResult = {
    createdOrUpdated: 0,
    failed: 0,
    errors: []
  };

  for (const customer of validCustomers) {
    const response = await fetch(`${BREVO_API_BASE}/contacts`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: customer.email,
        attributes: getCustomerAttributes(customer),
        listIds: listId ? [listId] : undefined,
        updateEnabled: true
      })
    });

    if (response.ok) {
      result.createdOrUpdated += 1;
      continue;
    }

    result.failed += 1;
    if (result.errors.length < 5) {
      const errorText = await response.text().catch(() => "");
      result.errors.push(`${customer.email}: ${errorText || response.statusText}`);
    }
  }

  return result;
}

export async function sendBrevoTestEmail(to: string) {
  const apiKey = getBrevoApiKey();
  if (!apiKey) throw new Error("Falta BREVO_API_KEY en el archivo .env.");

  const status = getBrevoStatus();
  if (!status.senderEmail) {
    throw new Error("Falta BREVO_SENDER_EMAIL en el archivo .env.");
  }

  const response = await fetch(`${BREVO_API_BASE}/smtp/email`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: {
        email: status.senderEmail,
        name: status.senderName
      },
      to: [{ email: to }],
      subject: "Prueba Brevo - Distrito Miami",
      htmlContent:
        "<h1>Distrito Miami</h1><p>Brevo quedo conectado correctamente para la tienda.</p>"
    })
  });

  const data = await response.json().catch(() => ({} as { messageId?: string; message?: string }));

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(data.message || text || "No se pudo enviar el correo de prueba con Brevo.");
  }

  return {
    messageId: data.messageId ?? ""
  };
}

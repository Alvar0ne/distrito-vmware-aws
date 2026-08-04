import crypto from "node:crypto";
import { z } from "zod";

const flowPaymentInput = z.object({
  orderId: z.string(),
  subject: z.string(),
  amount: z.number().int().positive(),
  email: z.string().email(),
  returnUrl: z.string().url(),
  confirmationUrl: z.string().url()
});

const flowCreateResponse = z.object({
  token: z.string(),
  url: z.string().url(),
  flowOrder: z.number().optional()
});

const flowStatusResponse = z.object({
  token: z.string().optional(),
  flowOrder: z.coerce.number().optional(),
  commerceOrder: z.string().optional(),
  status: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
  payer: z.string().optional()
});

export type FlowPaymentInput = z.infer<typeof flowPaymentInput>;
export type FlowPayment = z.infer<typeof flowCreateResponse> & {
  provider: "flow" | "demo";
};
export type FlowPaymentStatus = z.infer<typeof flowStatusResponse>;

function getFlowConfig() {
  const apiKey = process.env.FLOW_API_KEY?.trim();
  const secretKey = process.env.FLOW_SECRET_KEY?.trim();
  const apiUrl = (process.env.FLOW_API_URL ?? "https://www.flow.cl/api").replace(/\/$/, "");

  return {
    apiKey,
    apiUrl,
    secretKey,
    enabled: Boolean(apiKey && secretKey)
  };
}

function signParams(params: Record<string, string | number>, secretKey: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
}

function buildPaymentUrl(url: string, token: string) {
  const separator = url.includes("?") ? "&" : "?";
  return url.includes("token=") ? url : `${url}${separator}token=${encodeURIComponent(token)}`;
}

async function postFlow<T>(endpoint: string, params: Record<string, string | number>, schema: z.ZodType<T>) {
  const { apiKey, apiUrl, secretKey } = getFlowConfig();

  if (!apiKey || !secretKey) {
    throw new Error("Flow no esta configurado.");
  }

  const signedParams = {
    ...params,
    apiKey
  };
  const body = new URLSearchParams(
    Object.entries({
      ...signedParams,
      s: signParams(signedParams, secretKey)
    }).map(([key, value]) => [key, String(value)])
  );
  const response = await fetch(`${apiUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message ?? "Flow rechazo la solicitud.");
  }

  return schema.parse(data);
}

async function getFlow<T>(endpoint: string, params: Record<string, string | number>, schema: z.ZodType<T>) {
  const { apiKey, apiUrl, secretKey } = getFlowConfig();

  if (!apiKey || !secretKey) {
    throw new Error("Flow no esta configurado.");
  }

  const signedParams = {
    ...params,
    apiKey
  };
  const query = new URLSearchParams(
    Object.entries({
      ...signedParams,
      s: signParams(signedParams, secretKey)
    }).map(([key, value]) => [key, String(value)])
  );
  const response = await fetch(`${apiUrl}${endpoint}?${query.toString()}`, {
    method: "GET",
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message ?? "Flow rechazo la solicitud.");
  }

  return schema.parse(data);
}

export async function createFlowPayment(input: FlowPaymentInput): Promise<FlowPayment> {
  const payload = flowPaymentInput.parse(input);
  const config = getFlowConfig();

  if (!config.enabled) {
    return {
      provider: "demo",
      token: `demo-${payload.orderId}`,
      url: `/checkout?order=${payload.orderId}&payment=demo`
    };
  }

  const response = await postFlow("/payment/create", {
    commerceOrder: payload.orderId,
    subject: payload.subject,
    currency: "CLP",
    amount: payload.amount,
    email: payload.email,
    urlConfirmation: payload.confirmationUrl,
    urlReturn: payload.returnUrl
  }, flowCreateResponse);

  return {
    ...response,
    provider: "flow",
    url: buildPaymentUrl(response.url, response.token)
  };
}

export async function getFlowPaymentStatus(token: string) {
  const config = getFlowConfig();

  if (!config.enabled) {
    return {
      token,
      status: token.startsWith("demo-") ? 2 : 1
    };
  }

  return getFlow("/payment/getStatus", { token }, flowStatusResponse);
}

export function isFlowPaymentPaid(status?: number) {
  return status === 2;
}

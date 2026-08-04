import type { buildOrder } from "./orders";

export const PAYMENT_STATUSES = ["pending", "paid", "cancelled"] as const;
export const FULFILLMENT_STATUSES = ["received", "preparing", "shipped", "delivered", "cancelled"] as const;

export type OrderPaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type OrderFulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export type StoredOrder = Omit<ReturnType<typeof buildOrder>, "paymentStatus" | "fulfillmentStatus"> & {
  items: Array<ReturnType<typeof buildOrder>["items"][number] & { imageUrl?: string }>;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  paidEmailSent?: boolean;
  payment?: {
    provider: "flow" | "demo";
    token: string;
    url: string;
    flowOrder?: number;
  };
  createdAt: string;
};

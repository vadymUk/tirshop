import type { PaymentStatus } from "@/types/database";

/**
 * Provider-agnostic payment contract. Orders know nothing about Stripe/PayPal/etc.:
 * a provider adapter only translates between this contract and its own API.
 *
 * Security rules every adapter and caller must follow:
 *  - Amount and currency are ALWAYS read from the order in the database, never from the client.
 *  - An order becomes paid only through `recordPaymentEvent` (lib/payments/service.ts) after
 *    `handlePaymentWebhook` verified the provider's signature on the raw request body, or
 *    `verifyPayment` confirmed the payment with the provider's server API. A browser
 *    redirect/return URL is never proof of payment.
 *  - Adapters run on the server only and must not log secrets or card data.
 */

/** Stable identifiers; add a value here when a provider is introduced. */
export type PaymentProviderId = "stripe" | "paypal";

export type CreatePaymentInput = {
  orderId: string;
  /** Decimal string from orders.total_amount, e.g. "129.90". */
  amount: string;
  /** ISO 4217 code from orders.currency, e.g. "EUR". */
  currency: string;
  customerEmail: string;
  /** Same-origin URLs the provider sends the customer back to. These carry no payment proof. */
  returnUrl: string;
  cancelUrl: string;
  /** Lets the provider deduplicate retries; derive it from the order id. */
  idempotencyKey: string;
};

export type CreatePaymentResult = {
  /** Provider's id for this attempt; stored in payments.provider_payment_id. */
  providerPaymentId: string;
  /** Where to send the customer (hosted checkout) or data for an embedded client SDK. */
  next:
    | { type: "redirect"; url: string }
    | { type: "client_secret"; clientSecret: string };
  status: PaymentStatus;
};

export type VerifyPaymentResult = {
  providerPaymentId: string;
  status: PaymentStatus;
  /** Amount/currency as the provider reports them; compared with the order before marking paid. */
  amount: string;
  currency: string;
};

/**
 * A provider notification after signature verification, normalised to one shape.
 * `eventId` is the provider's unique event id and is the idempotency key.
 */
export type PaymentEvent = {
  provider: PaymentProviderId;
  eventId: string;
  providerPaymentId: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  /** Raw provider payload kept for audit; must not contain card data. */
  payload: Record<string, unknown>;
};

export type HandleWebhookResult =
  /** Verified and normalised; the caller persists it with recordPaymentEvent. */
  | { type: "event"; event: PaymentEvent }
  /** Valid but irrelevant event type: acknowledge with 2xx and do nothing. */
  | { type: "ignored" };

export type RefundPaymentInput = {
  providerPaymentId: string;
  /** Omit for a full refund. */
  amount?: string;
  reason?: string;
  idempotencyKey: string;
};

export type RefundPaymentResult = {
  providerRefundId: string;
  /** Refunds are confirmed by a webhook event too; do not set refunded from this value alone. */
  status: "pending" | "succeeded" | "failed";
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;

  /** Starts a payment attempt for an existing order. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /** Server-to-server lookup of the real payment state at the provider. */
  verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResult>;

  /**
   * Verifies the signature of a webhook request and normalises it.
   * Receives the RAW body (signature checks fail on re-serialised JSON).
   * Must throw `PaymentError("invalid_signature")` when verification fails.
   */
  handlePaymentWebhook(request: { rawBody: string; headers: Headers }): Promise<HandleWebhookResult>;

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}

export type PaymentErrorCode =
  | "provider_not_configured"
  | "invalid_signature"
  | "amount_mismatch"
  | "provider_error";

export class PaymentError extends Error {
  constructor(
    public readonly code: PaymentErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PaymentError";
  }
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentError, type PaymentEvent } from "@/lib/payments/types";
import type { Json } from "@/types/database";

export type RecordPaymentEventResult = "applied" | "duplicate" | "ignored";

/**
 * The ONLY code path that may change a payment or an order's payment_status.
 *
 * Call it from a webhook route handler after `PaymentProvider.handlePaymentWebhook`
 * verified the signature (or after `verifyPayment` confirmed the state server-side).
 * Never call it with data taken from a browser request. It uses the service role, and the
 * database function behind it is executable by the service role only; it additionally
 * deduplicates events, enforces the status transitions and checks amount and currency
 * against the order.
 */
export async function recordPaymentEvent(event: PaymentEvent): Promise<RecordPaymentEventResult> {
  const { data, error } = await createAdminClient().rpc("apply_payment_event", {
    p_provider: event.provider,
    p_event_id: event.eventId,
    p_provider_payment_id: event.providerPaymentId,
    p_status: event.status,
    p_amount: Number(event.amount),
    p_currency: event.currency,
    p_payload: event.payload as Json,
  });

  if (error) {
    if (error.message.includes("amount_mismatch")) throw new PaymentError("amount_mismatch");
    throw new PaymentError("provider_error", error.message);
  }
  return data as RecordPaymentEventResult;
}

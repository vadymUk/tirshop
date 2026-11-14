import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyOrderEmailFailure(orderId: string, sourceId = orderId) {
  try {
    const result = await createAdminClient().rpc("record_order_email_failure", { p_order: orderId, p_source: sourceId });
    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    console.error(`[notifications] Failed to record email failure for order ${orderId}:`, error);
  }
}

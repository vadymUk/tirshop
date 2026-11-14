"use server";

import { revalidatePath, updateTag } from "next/cache";
import { authorizeAdminOperation } from "@/lib/admin/security";
import { orderDetailsSchema, orderTransitionSchema, statusLabels } from "@/lib/admin/order-validation";
import { createClient } from "@/lib/supabase/server";
import { getFromAddress, getResend } from "@/lib/email/resend";
import { render } from "@react-email/components";
import { OrderStatusEmail } from "@/emails/order-status";
import { notifyOrderEmailFailure } from "@/lib/admin/notifications-email";

export type OrderActionState = { error?: string; success?: string; warning?: string };

function invalidate(id: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${id}`);
  updateTag("products");
}

export async function transitionOrder(_state: OrderActionState, form: FormData): Promise<OrderActionState> {
  await authorizeAdminOperation("order-transition");
  const parsed = orderTransitionSchema.safeParse({
    id: form.get("id"), expected: form.get("expected"), status: form.get("status"),
    note: form.get("note"), notify: form.get("notify") === "on",
  });
  if (!parsed.success) return { error: "Некоректний перехід або дані." };
  const { id, expected, status, note, notify } = parsed.data;
  const db = await createClient();
  const { data: event, error } = await db.rpc("admin_transition_order", {
    p_order_id: id, p_expected: expected, p_status: status, p_note: note || null,
  });
  if (error || !event) {
    console.error("Order transition failed:", error);
    if (error?.message.includes("order_status_conflict")) return { error: "Статус уже змінився. Оновіть сторінку." };
    if (error?.message.includes("legacy_cancellation_requires_review")) return { error: "Замовлення раніше скасовували: потрібна ручна звірка залишків." };
    if (error?.message.includes("legacy_stock_requires_review")) return { error: "Замовлення створене до оновлення. Потрібна ручна звірка складської історії перед скасуванням." };
    if (error?.message.includes("missing_order_products")) return { error: "Товар замовлення відсутній: потрібна ручна звірка залишків." };
    return { error: "Не вдалося змінити статус замовлення." };
  }
  invalidate(id);
  if (!notify) return { success: "Статус змінено." };
  const settings = await db.rpc("get_admin_site_settings");
  if (settings.error || !settings.data?.[0]) {
    console.error("Order status notification settings lookup failed:", settings.error);
    await notifyOrderEmailFailure(id, event);
    return { success: "Статус змінено.", warning: "Не вдалося перевірити налаштування сповіщень. Лист не надіслано." };
  }
  if (!settings.data[0].order_status_notifications) return { success: "Статус змінено.", warning: "Сповіщення про статус вимкнено в налаштуваннях магазину." };
  const { data: order, error: loadError } = await db.from("orders").select("customer_email,customer_name,order_number").eq("id", id).single();
  if (loadError || !order) {
    console.error("Order status email lookup failed:", loadError);
    await notifyOrderEmailFailure(id, event);
    return { success: "Статус змінено.", warning: "Не вдалося отримати адресу для повідомлення. Лист не надіслано." };
  }
  try {
    const html = await render(OrderStatusEmail({ name: order.customer_name, number: order.order_number, status: statusLabels[status] }));
    const sent = await getResend().emails.send({
      from: getFromAddress(), to: order.customer_email,
      subject: `Замовлення #${order.order_number}: ${statusLabels[status]}`, html,
    }, { idempotencyKey: `order-status/${event}` });
    if (sent.error) throw new Error(sent.error.message);
    return { success: "Статус змінено, повідомлення передано до Resend." };
  } catch (sendError) {
    console.error(`Order status email failed for event ${event}:`, sendError);
    await notifyOrderEmailFailure(id, event);
    return { success: "Статус змінено.", warning: "Resend не підтвердив надсилання. Перевірте журнал Resend перед повторним повідомленням клієнта." };
  }
}

export async function saveOrderDetails(_state: OrderActionState, form: FormData): Promise<OrderActionState> {
  await authorizeAdminOperation("order-details");
  const parsed = orderDetailsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Перевірте довжину та правильність полів." };
  const { id, internal_note, shipping_provider, tracking_number } = parsed.data;
  const { data, error } = await (await createClient()).rpc("admin_save_order_details", {
    p_order_id: id, p_internal_note: internal_note, p_shipping_provider: shipping_provider, p_tracking_number: tracking_number,
  });
  if (error || !data) {
    console.error("Order private details update failed:", error);
    return { error: "Не вдалося зберегти дані замовлення." };
  }
  invalidate(id);
  return { success: "Дані збережено." };
}

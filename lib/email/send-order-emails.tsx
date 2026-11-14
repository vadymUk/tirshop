import "server-only";
import { render } from "@react-email/components";
import CustomerConfirmationEmail from "@/emails/customer-confirmation";
import OrderEmail from "@/emails/order-email";
import type { EmailOrder } from "@/emails/types";
import { formatOrderDate, formatOrderNumber } from "@/lib/checkout/format";
import type { OrderWithItems } from "@/lib/db/queries/orders";
import { getFromAddress, getResend, getSellerEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@/types/database";
import { z } from "zod";
import { notifyOrderEmailFailure } from "@/lib/admin/notifications-email";

export type SendOrderEmailsResult = { seller: boolean; customer: boolean };

const LOCALE = "uk-UA";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Очікує підтвердження",
  confirmed: "Підтверджено",
  processing: "В обробці",
  shipped: "Відправлено",
  completed: "Виконано",
  cancelled: "Скасовано",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Очікує оплати",
  paid: "Оплачено",
  failed: "Помилка оплати",
  refunded: "Повернено",
};

/** Maps a stored order to display-ready template data. */
function toEmailOrder(order: OrderWithItems): EmailOrder {
  const money = (amount: number) => formatPrice(amount, order.currency, LOCALE);
  return {
    orderNumber: formatOrderNumber(order.order_number),
    orderDate: formatOrderDate(order.created_at, LOCALE),
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    country: order.country,
    city: order.city,
    postalCode: order.postal_code,
    address: order.address,
    apartment: order.apartment,
    notes: order.notes,
    items: order.order_items.map((item) => ({
      name: item.product_name,
      description: item.product_description,
      quantity: item.quantity,
      unitPrice: money(item.unit_price),
      subtotal: money(item.subtotal),
    })),
    total: money(order.total_amount),
    currency: order.currency,
    status: ORDER_STATUS_LABELS[order.status],
    paymentStatus: PAYMENT_STATUS_LABELS[order.payment_status],
  };
}

/** Logs a failure without leaking secrets or customer data. */
function logEmailFailure(kind: string, orderId: string, error: unknown) {
  const reason =
    error instanceof Error
      ? error.name === "ZodError"
        ? "invalid or missing email environment variables"
        : `${error.name}: ${error.message}`
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : "unknown error";
  console.error(`[email] ${kind} email failed for order ${orderId}: ${reason}`);
}

async function deliver(
  kind: "seller" | "customer",
  orderId: string,
  send: () => Promise<{ error: unknown }>,
): Promise<boolean> {
  try {
    const { error } = await send();
    if (error) {
      logEmailFailure(kind, orderId, error);
      return false;
    }
    return true;
  } catch (error) {
    logEmailFailure(kind, orderId, error);
    return false;
  }
}

/**
 * Sends the seller notification and the customer confirmation for an existing order.
 *
 * Never throws: the order is already committed, so a mail problem is logged and
 * reported in the result instead. The two emails are independent; one failing does not
 * stop the other. The order is read with the admin client because this runs in the
 * background after the response; the id comes from place_order, never from the client.
 */
export async function sendOrderEmails(orderId: string): Promise<SendOrderEmailsResult> {
  const result: SendOrderEmailsResult = { seller: false, customer: false };

  let order: OrderWithItems | null;
  try {
    const { data, error } = await createAdminClient()
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .order("created_at", { referencedTable: "order_items", ascending: true })
      .maybeSingle();
    if (error) throw new Error(error.message);
    order = data;
  } catch (error) {
    logEmailFailure("order lookup", orderId, error);
    await notifyOrderEmailFailure(orderId);
    return result;
  }
  if (!order) {
    console.error(`[email] order ${orderId} not found, no emails sent`);
    await notifyOrderEmailFailure(orderId);
    return result;
  }

  const stored: OrderWithItems = order;
  const emailOrder = toEmailOrder(stored);
  let sellerEmail: string;
  let customerEnabled: boolean;
  try {
    const settings = await createAdminClient().from("site_settings")
      .select("seller_notification_email,customer_email_notifications").limit(1).maybeSingle();
    if (settings.error || !settings.data) throw new Error(settings.error?.message ?? "missing settings");
    sellerEmail = z.string().email().parse(settings.data.seller_notification_email || getSellerEmail());
    customerEnabled = settings.data.customer_email_notifications;
  } catch (error) {
    logEmailFailure("settings lookup", orderId, error);
    await notifyOrderEmailFailure(orderId);
    return result;
  }

  const [seller, customer] = await Promise.all([
    deliver("seller", orderId, async () => {
      const html = await render(OrderEmail({ order: emailOrder }));
      return getResend().emails.send(
        {
          from: getFromAddress(),
          to: sellerEmail,
          replyTo: stored.customer_email,
          subject: `Нове замовлення ${emailOrder.orderNumber} — ${emailOrder.total}`,
          html,
        },
        { idempotencyKey: `order-seller/${orderId}` },
      );
    }),
    customerEnabled ? deliver("customer", orderId, async () => {
      const html = await render(CustomerConfirmationEmail({ order: emailOrder }));
      return getResend().emails.send(
        {
          from: getFromAddress(),
          to: stored.customer_email,
          replyTo: sellerEmail,
          subject: `Ваше замовлення ${emailOrder.orderNumber} прийнято`,
          html,
        },
        { idempotencyKey: `order-customer/${orderId}` },
      );
    }) : Promise.resolve(false),
  ]);

  if (!seller || (customerEnabled && !customer)) await notifyOrderEmailFailure(orderId);
  return { seller, customer };
}

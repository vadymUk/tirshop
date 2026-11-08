import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { formatOrderDate, formatOrderNumber } from "@/lib/checkout/format";
import { getOrder } from "@/lib/db/queries/orders";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders-labels";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Деталі замовлення" };

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/account/orders/${id}`);

  // Malformed ids and orders of other users are indistinguishable: both are a 404.
  if (!z.string().uuid().safeParse(id).success) notFound();
  const order = await getOrder(id);
  if (!order) notFound();

  const shipping = [
    order.address,
    order.apartment,
    `${order.postal_code} ${order.city}`,
    order.country,
  ].filter(Boolean);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-1">
        <Link href="/account/orders" className="text-sm text-muted-foreground hover:underline">
          ← Усі замовлення
        </Link>
        <h1 className="text-2xl font-bold">
          Замовлення {formatOrderNumber(order.order_number)}
        </h1>
        <p className="text-sm text-muted-foreground">{formatOrderDate(order.created_at)}</p>
      </div>

      <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
        <dt className="text-muted-foreground">Статус замовлення</dt>
        <dd>{ORDER_STATUS_LABELS[order.status]}</dd>
        <dt className="text-muted-foreground">Статус оплати</dt>
        <dd>{PAYMENT_STATUS_LABELS[order.payment_status]}</dd>
      </dl>

      <section aria-labelledby="items-heading" className="space-y-3">
        <h2 id="items-heading" className="text-lg font-semibold">
          Товари
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="p-3 font-medium">Товар</th>
                <th scope="col" className="p-3 text-right font-medium">Ціна</th>
                <th scope="col" className="p-3 text-right font-medium">К-сть</th>
                <th scope="col" className="p-3 text-right font-medium">Сума</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.order_items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3">
                    <p className="font-medium">{item.product_name}</p>
                    {item.product_description && (
                      <p className="line-clamp-2 text-muted-foreground">
                        {item.product_description}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-right">{formatPrice(item.unit_price, order.currency)}</td>
                  <td className="p-3 text-right">{item.quantity}</td>
                  <td className="p-3 text-right">{formatPrice(item.subtotal, order.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <th scope="row" colSpan={3} className="p-3 text-right">
                  Разом
                </th>
                <td className="p-3 text-right">
                  {formatPrice(order.total_amount, order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section aria-labelledby="shipping-heading" className="space-y-3">
        <h2 id="shipping-heading" className="text-lg font-semibold">
          Доставка
        </h2>
        <address className="space-y-0.5 text-sm not-italic">
          <p className="font-medium">{order.customer_name}</p>
          {shipping.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="pt-1 text-muted-foreground">
            {order.customer_phone} · {order.customer_email}
          </p>
        </address>
        {order.notes && (
          <p className="text-sm">
            <span className="text-muted-foreground">Примітка: </span>
            {order.notes}
          </p>
        )}
      </section>
    </div>
  );
}
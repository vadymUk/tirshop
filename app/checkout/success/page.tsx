import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatOrderDate, formatOrderNumber } from "@/lib/checkout/format";
import { getOrder } from "@/lib/db/queries/orders";
import { formatPrice } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = {
  title: "Замовлення оформлено",
  robots: { index: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  await requireUser("/checkout");
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);

  const { order: orderParam } = await searchParams;
  const orderId = z.string().uuid().safeParse(orderParam);
  if (!orderId.success) notFound();

  // RLS + user filter: only the owner can load the order.
  const order = await getOrder(orderId.data);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-14 text-green-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold">{t("Order placed")}</h1>
        <p role="status" className="max-w-prose text-muted-foreground">
          {t("Ваше замовлення успішно відправлено. Найближчим часом ми зв'яжемося з вами для підтвердження замовлення та узгодження способу оплати.")}
        </p>
      </div>

      <dl className="grid gap-4 rounded-lg border p-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">{t("Order number")}</dt>
          <dd className="font-semibold">{formatOrderNumber(order.order_number)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("Date")}</dt>
          <dd className="font-semibold">{formatOrderDate(order.created_at)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("Total")}</dt>
          <dd className="font-semibold">{formatPrice(order.total_amount, order.currency)}</dd>
        </div>
      </dl>

      <section aria-labelledby="order-items-heading" className="rounded-lg border p-5">
        <h2 id="order-items-heading" className="mb-3 font-semibold">
          {t("Items")}
        </h2>
        <ul className="divide-y text-sm">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-2">
              <span>
                {item.product_name}{" "}
                <span className="text-muted-foreground">× {item.quantity}</span>
              </span>
              <span className="font-medium">{formatPrice(item.subtotal, order.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("You can review this order and its status in your account.")}
        </p>
        <Link
          href={`/account/orders/${order.id}`}
          className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
        >
          {t("View order details")}
        </Link>
      </section>

      <div className="flex justify-center">
        <Button asChild>
          <Link href="/products">{t("Continue shopping")}</Link>
        </Button>
      </div>
    </div>
  );
}

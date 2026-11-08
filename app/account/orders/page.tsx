import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { formatOrderDate, formatOrderNumber } from "@/lib/checkout/format";
import { getUserOrders } from "@/lib/db/queries/orders";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders-labels";
import { formatPrice } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = { title: "Мої замовлення" };

export default async function OrdersPage() {
  await requireUser("/account/orders");
  const [orders, language] = await Promise.all([getUserOrders(), getLanguage()]);
  const t = (source: string) => translate(language, source);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t("Мої замовлення")}</h1>
      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("Замовлень ще немає")}
          description={t("Ваші замовлення з'являться тут після оформлення.")}
          action={
            <Link href="/products" className={buttonVariants()}>
              {t("Перейти до товарів")}
            </Link>
          }
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div>
                  <p className="font-semibold">{formatOrderNumber(order.order_number)}</p>
                  <p className="text-muted-foreground">{formatOrderDate(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatPrice(order.total_amount, order.currency)}
                  </p>
                  <p className="text-muted-foreground">
                    {t(ORDER_STATUS_LABELS[order.status])} ·{" "}
                    {t(PAYMENT_STATUS_LABELS[order.payment_status])}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
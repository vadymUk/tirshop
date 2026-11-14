import { z } from "zod";

export const notificationKinds = ["new_order", "low_stock", "out_of_stock", "order_cancelled", "email_failure", "security"] as const;
export const notificationLabels: Record<(typeof notificationKinds)[number], string> = {
  new_order: "Нове замовлення",
  low_stock: "Малий залишок товару",
  out_of_stock: "Товар закінчився",
  order_cancelled: "Замовлення скасовано",
  email_failure: "Не вдалося надіслати лист",
  security: "Вхід адміністратора",
};

export const preferencesSchema = z.object({
  new_order: z.boolean(),
  low_stock: z.boolean(),
  out_of_stock: z.boolean(),
  order_cancelled: z.boolean(),
  email_failure: z.boolean(),
  security: z.boolean(),
}).strict();
export const notificationFeedSchema = z.object({
  unread: z.number().int().nonnegative(),
  items: z.array(z.object({
    id: z.string().uuid(),
    kind: z.enum(notificationKinds),
    entity_id: z.string().uuid().nullable(),
    created_at: z.string().datetime({ offset: true }),
    is_read: z.boolean(),
  })),
  preferences: preferencesSchema,
});
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;
export type NotificationPreferences = z.infer<typeof preferencesSchema>;
export type NotificationItem = NotificationFeed["items"][number];

export function notificationLink(item: NotificationItem): string {
  if (item.kind === "security") return "/admin/activity";
  if (!item.entity_id) return item.kind === "low_stock" || item.kind === "out_of_stock" ? "/admin/inventory" : "/admin/orders";
  return item.kind === "low_stock" || item.kind === "out_of_stock"
    ? `/admin/inventory/${item.entity_id}`
    : `/admin/orders/${item.entity_id}`;
}

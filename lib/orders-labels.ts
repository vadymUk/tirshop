import type { OrderStatus, PaymentStatus } from "@/types/database";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Очікує підтвердження",
  confirmed: "Підтверджено",
  processing: "В обробці",
  shipped: "Відправлено",
  completed: "Виконано",
  cancelled: "Скасовано",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Очікує оплати",
  paid: "Оплачено",
  failed: "Помилка оплати",
  refunded: "Повернено",
};
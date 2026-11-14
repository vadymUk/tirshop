import { z } from "zod";
import type { OrderStatus } from "@/types/database";

export const statusSchema = z.enum(["pending", "confirmed", "processing", "shipped", "completed", "cancelled"]);
export const statusLabels: Record<OrderStatus, string> = {
  pending: "Очікує підтвердження", confirmed: "Підтверджено", processing: "В обробці",
  shipped: "Відправлено", completed: "Виконано", cancelled: "Скасовано",
};
export const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"], confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"], shipped: ["completed"], completed: [], cancelled: [],
};
export const orderTransitionSchema = z.object({
  id: z.string().uuid(), expected: statusSchema, status: statusSchema,
  note: z.string().trim().max(1000), notify: z.boolean(),
}).refine((value) => transitions[value.expected].includes(value.status));
export const orderDetailsSchema = z.object({
  id: z.string().uuid(), internal_note: z.string().trim().max(5000),
  shipping_provider: z.string().trim().max(120), tracking_number: z.string().trim().max(200),
});

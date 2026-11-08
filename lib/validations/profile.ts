import { z } from "zod";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Вкажіть ім'я")
    .max(200, "Ім'я надто довге"),
  phone: z
    .string()
    .trim()
    .max(30, "Номер телефону надто довгий")
    .refine(
      (value) => value === "" || /^\+?[0-9\s().-]+$/.test(value),
      "Використовуйте лише цифри, пробіли та + ( ) -",
    )
    .refine(
      (value) => value === "" || value.replace(/\D/g, "").length >= 6,
      "Номер телефону надто короткий",
    ),
});

export type ProfileInput = z.infer<typeof profileSchema>;
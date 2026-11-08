import { z } from "zod";

import { SHIPPING_COUNTRIES } from "@/lib/checkout/countries";

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

/** Checkout form. Prices and totals are deliberately absent: the server computes them. */
export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(200, "Name is too long"),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email address")
    .max(254, "Email is too long"),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number")
    .max(30, "Phone number is too long")
    .regex(/^\+?[0-9\s().-]+$/, "Use digits, spaces and + ( ) - only")
    .refine((value) => value.replace(/\D/g, "").length >= 6, "Phone number is too short"),
  country: z.enum(SHIPPING_COUNTRIES, { message: "Select a country" }),
  city: z.string().trim().min(1, "Enter your city").max(120, "City name is too long"),
  postalCode: z
    .string()
    .trim()
    .min(2, "Enter your postal code")
    .max(20, "Postal code is too long")
    .regex(/^[A-Za-z0-9][A-Za-z0-9\s-]*$/, "Use letters, digits, spaces and hyphens only"),
  address: z
    .string()
    .trim()
    .min(3, "Enter your street address")
    .max(300, "Address is too long"),
  apartment: optionalText(50, "Apartment / house number"),
  notes: optionalText(1000, "Notes"),
  acceptTerms: z.boolean().refine(Boolean, {
    message: "You must accept the terms and privacy policy to place an order.",
  }),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

import { z } from "zod";
import { seoImagePath } from "@/lib/admin/media-shared";

const optionalText = (max: number) => z.string().trim().max(max);
const optionalNumber = (max: number) => z.union([z.literal(""), z.coerce.number().finite().min(0).max(max)]);

export const productSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]),
  category_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sku: optionalText(100),
  short_description: optionalText(1000),
  description: optionalText(20000),
  price: z.coerce.number().finite().positive().max(9999999999.99).multipleOf(0.01),
  compare_at_price: optionalNumber(9999999999.99),
  currency: z.string().regex(/^[A-Z]{3}$/),
  stock_quantity: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(1_000_000_000)),
  expected_stock: z.union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000_000)]),
  weight: optionalNumber(9999999.999),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  meta_title: optionalText(200),
  meta_description: optionalText(500),
  og_image_path: z.union([z.literal(""), seoImagePath]),
}).superRefine((value, context) => {
  if (value.id && value.expected_stock === "") context.addIssue({ code: "custom", path: ["expected_stock"], message: "Не вказано початковий залишок." });
  if (value.compare_at_price !== "" && Math.abs(Math.round(value.compare_at_price * 100) - value.compare_at_price * 100) > 1e-6) context.addIssue({ code: "custom", path: ["compare_at_price"], message: "Не більше двох знаків після коми." });
  if (value.weight !== "" && Math.abs(Math.round(value.weight * 1000) - value.weight * 1000) > 1e-6) context.addIssue({ code: "custom", path: ["weight"], message: "Не більше трьох знаків після коми." });
});

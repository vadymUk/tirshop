import { z } from "zod";

export const categorySchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(20000),
  is_active: z.boolean(),
  sort_order: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(1_000_000)),
  meta_title: z.string().trim().max(200),
  meta_description: z.string().trim().max(500),
});

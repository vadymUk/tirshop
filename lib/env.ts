import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS: z.enum(["true", "false"]).default("false"),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

// Kept separate so a missing email variable never breaks unrelated server features.
const emailSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  /** Sender on a domain verified in Resend, e.g. "Truck Shop <orders@your-domain.com>". */
  RESEND_FROM_EMAIL: z.string().min(3),
  /** Where new-order notifications are delivered. */
  SELLER_EMAIL: z.string().trim().email(),
});

// NEXT_PUBLIC_* values must be referenced statically so Next.js can inline them.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS:
    process.env.NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORMS || undefined,
});

/** Server-only variables. Call lazily on the server; throws in the browser. */
export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in the browser");
  }
  return serverSchema.parse(process.env);
}

/** Email variables (RESEND_API_KEY, RESEND_FROM_EMAIL, SELLER_EMAIL). Server only. */
export function getEmailEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getEmailEnv() must not be called in the browser");
  }
  return emailSchema.parse(process.env);
}

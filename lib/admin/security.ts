import "server-only";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const auditEventSchema = z.object({
  action: z.enum(["upload", "delete", "attach", "reorder", "delete_all"]),
  entityType: z.enum(["media", "product_image"]),
  entityId: z.string().uuid().optional(),
  metadata: z.object({
    bucket: z.enum(["site-media", "product-images"]).optional(),
    uploaded_count: z.number().int().min(0).max(999999).optional(),
    image_count: z.number().int().min(0).max(999999).optional(),
    deleted_count: z.number().int().min(0).max(999999).optional(),
  }).strict().default({}),
}).strict();

export class AdminRateLimitError extends Error {
  constructor() {
    super("Too many administrative requests. Please try again later.");
    this.name = "AdminRateLimitError";
  }
}

/** Re-authenticates the caller and applies the shared application rate limiter. */
export async function authorizeAdminOperation(
  action: string,
  limit = 30,
  windowSeconds = 60,
) {
  const user = await requireActiveAdmin();
  if (await isRateLimited(action, limit, windowSeconds)) {
    throw new AdminRateLimitError();
  }
  return user;
}

/** Appends an audit event through an admin-only database function. */
export async function auditLog(input: unknown) {
  const parsed = auditEventSchema.parse(input);
  const user = await requireActiveAdmin();
  const { data, error } = await createAdminClient().rpc("record_trusted_admin_activity", {
    p_actor: user.id,
    p_action: parsed.action,
    p_entity_type: parsed.entityType,
    p_entity_id: parsed.entityId ?? null,
    p_metadata: parsed.metadata,
  });

  if (error) throw new Error(`Failed to write admin activity for ${user.id}: ${error.message}`);
  if (!data) throw new AdminRateLimitError();
}

export async function logAdminActivity(input: unknown) {
  return auditLog(input);
}

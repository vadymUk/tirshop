"use server";

import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { notificationFeedSchema, preferencesSchema } from "@/lib/admin/notifications";
import { createClient } from "@/lib/supabase/server";

export async function loadNotifications(offset: number) {
  const parsed = z.number().int().min(0).max(1_000_000).parse(offset);
  await requireActiveAdmin();
  const db = await createClient();
  const sync = await db.rpc("admin_sync_notifications");
  if (sync.error) {
    console.error("Notification synchronization failed:", sync.error);
    throw new Error("Не вдалося оновити сповіщення.");
  }
  const feed = await db.rpc("admin_notification_feed", { p_offset: parsed, p_limit: 11 });
  if (feed.error) {
    console.error("Notification feed failed:", feed.error);
    throw new Error("Не вдалося завантажити сповіщення.");
  }
  return notificationFeedSchema.parse(feed.data);
}

export async function markNotificationsRead(id: string | null) {
  const parsed = z.string().uuid().nullable().parse(id);
  await requireActiveAdmin();
  const db = await createClient();
  const result = await db.rpc("admin_notification_mark", { p_id: parsed });
  if (result.error) {
    console.error("Marking notifications as read failed:", result.error);
    throw new Error("Не вдалося позначити сповіщення прочитаними.");
  }
}

export async function saveNotificationPreferences(input: unknown) {
  const parsed = preferencesSchema.parse(input);
  await requireActiveAdmin();
  const db = await createClient();
  const result = await db.rpc("admin_notification_set_preferences", { p_preferences: parsed });
  if (result.error) {
    console.error("Saving notification preferences failed:", result.error);
    throw new Error("Не вдалося зберегти налаштування сповіщень.");
  }
}

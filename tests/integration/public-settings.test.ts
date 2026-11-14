import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/query-builder";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => (state.db as ReturnType<typeof createFakeSupabase>).client,
}));
import { contactLinks, getPublicSettings } from "@/lib/settings/public";

const settings = {
  store_name: "Store", store_description: null, logo_path: null, favicon_path: null,
  contact_email: null, contact_phone: null, whatsapp_number: null, viber_number: null,
  telegram_username: null, business_address: null, company_name: null, nip: null,
  regon: null, vat_details: null, return_address: null, currency: "EUR", default_language: "uk",
  timezone: "Europe/Warsaw", facebook_url: null, instagram_url: null, tiktok_url: null,
  youtube_url: null, announcement_text: null, announcement_enabled: false,
};

beforeEach(() => { state.db = createFakeSupabase(); });

describe("public store settings", () => {
  it("uses configured contacts and leaves empty channels disabled", async () => {
    (state.db as ReturnType<typeof createFakeSupabase>).queueTable("site_settings", { data: {
      ...settings, contact_phone: "+48 111 222 333", whatsapp_number: "", viber_number: "+48 444 555 666",
      telegram_username: "store_name", facebook_url: "https://facebook.com/store",
    }, error: null });
    const data = await getPublicSettings();
    expect(contactLinks(data)).toEqual({
      phone: "tel:+48111222333", whatsapp: "", viber: "viber://chat?number=%2B48444555666",
      telegram: "https://t.me/store_name",
    });
    expect(data.facebook_url).toBe("https://facebook.com/store");
  });

  it("retains legacy contacts only for unset fields, not explicit empty values", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("site_settings", { data: settings, error: null });
    expect(contactLinks(await getPublicSettings()).whatsapp).toBeTruthy();
    db.queueTable("site_settings", { data: { ...settings, contact_phone: "", whatsapp_number: "", viber_number: "", telegram_username: "" }, error: null });
    expect(contactLinks(await getPublicSettings())).toEqual({ phone: "", whatsapp: "", viber: "", telegram: "" });
  });

  it("rejects unsafe stored URLs and surfaces database failures", async () => {
    const db = state.db as ReturnType<typeof createFakeSupabase>;
    db.queueTable("site_settings", { data: { ...settings, facebook_url: "javascript:alert(1)" }, error: null });
    await expect(getPublicSettings()).rejects.toThrow();
    db.queueTable("site_settings", { data: null, error: { message: "unavailable" } });
    await expect(getPublicSettings()).rejects.toThrow("unavailable");
  });
});

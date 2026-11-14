"use client";

import { Tabs } from "radix-ui";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadMedia } from "@/lib/admin/media-actions";
import { saveStoreSettings } from "@/lib/admin/settings-actions";
import type { SettingsSection } from "@/lib/admin/settings-validation";
import type { Database } from "@/types/database";

type Settings = Database["public"]["Tables"]["site_settings"]["Row"];
const input = "min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium";
const tabs: { value: SettingsSection; title: string }[] = [
  { value: "general", title: "Загальні" }, { value: "contact", title: "Контакти" },
  { value: "social", title: "Соціальні мережі" }, { value: "appearance", title: "Вигляд сайту" },
  { value: "behavior", title: "Робота магазину" }, { value: "notifications", title: "Сповіщення" },
  { value: "legal", title: "Юридичні реквізити" },
];

export function StoreSettingsEditor({ settings }: { settings: Settings }) {
  const [revision, setRevision] = useState(settings.updated_at);
  const [logo, setLogo] = useState(settings.logo_path ?? "");
  const [favicon, setFavicon] = useState(settings.favicon_path ?? "");
  const [address, setAddress] = useState(settings.business_address ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save(section: SettingsSection, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form);
    if (section === "appearance") values.announcement_enabled = form.has("announcement_enabled") ? "true" : "false";
    const payload = section === "appearance" ? { ...values, announcement_enabled: values.announcement_enabled === "true" }
      : section === "notifications" ? { ...values, customer_email_notifications: form.has("customer_email_notifications"), order_status_notifications: form.has("order_status_notifications") }
      : values;
    startTransition(async () => {
      try {
        setError(""); setMessage("");
        const next = await saveStoreSettings(section, settings.id, revision, payload);
        setRevision(next); setMessage("Налаштування збережено."); router.refresh();
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Не вдалося зберегти налаштування."); }
    });
  }

  function upload(file: File | undefined, target: "logo" | "favicon") {
    if (!file) return;
    startTransition(async () => {
      try {
        setError(""); setMessage("");
        const form = new FormData(); form.set("file", file); form.set("bucket", "site-media");
        const result = await uploadMedia(form);
        if (target === "logo") setLogo(result.path); else setFavicon(result.path);
        setMessage("Зображення завантажено. Збережіть розділ «Вигляд сайту».");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Не вдалося завантажити зображення."); }
    });
  }

  const submit = <button disabled={pending} className="min-h-10 rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? "Збереження…" : "Зберегти розділ"}</button>;
  return <div className="space-y-4">
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="break-words rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <Tabs.Root defaultValue="general">
      <Tabs.List aria-label="Розділи налаштувань" className="flex flex-wrap gap-2">
        {tabs.map((tab) => <Tabs.Trigger key={tab.value} value={tab.value} className="min-h-10 rounded border bg-white px-3 py-2 text-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white">{tab.title}</Tabs.Trigger>)}
      </Tabs.List>
      <Tabs.Content value="general" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={(event) => save("general", event)} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <label className={label}>Назва магазину<input className={input} name="store_name" defaultValue={settings.store_name} maxLength={200} required /></label>
          <label className={label}>Мова за замовчуванням<select className={input} name="default_language" defaultValue={["uk", "pl", "ru"].includes(settings.default_language.split("-")[0]) ? settings.default_language.split("-")[0] : ""}><option value="" disabled>Оберіть підтримувану мову</option><option value="uk">Українська</option><option value="pl">Польська</option><option value="ru">Російська</option></select></label>
          <label className={`${label} sm:col-span-2`}>Опис<textarea className={input} name="store_description" defaultValue={settings.store_description ?? ""} maxLength={2000} /></label>
          <label className={label}>Валюта (ISO)<input className={input} name="currency" defaultValue={settings.currency} pattern="[A-Z]{3}" required /></label>
          <label className={label}>Часовий пояс<input className={input} name="timezone" defaultValue={settings.timezone} required /></label>
          <div className="sm:col-span-2">{submit}</div>
        </form>
      </Tabs.Content>
      <Tabs.Content value="contact" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={(event) => save("contact", event)} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <label className={label}>Email<input type="email" className={input} name="contact_email" defaultValue={settings.contact_email ?? ""} /></label>
          <label className={label}>Телефон<input type="tel" className={input} name="contact_phone" defaultValue={settings.contact_phone ?? ""} /></label>
          <label className={label}>WhatsApp (міжнародний номер із +)<input type="tel" className={input} name="whatsapp_number" defaultValue={settings.whatsapp_number ?? ""} /></label>
          <label className={label}>Viber (міжнародний номер із +)<input type="tel" className={input} name="viber_number" defaultValue={settings.viber_number ?? ""} /></label>
          <label className={label}>Ім’я користувача Telegram без @<input className={input} name="telegram_username" defaultValue={settings.telegram_username ?? ""} /></label>
          <label className={label}>Адреса<input className={input} name="business_address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <div className="sm:col-span-2">{submit}</div>
        </form>
      </Tabs.Content>
      <Tabs.Content value="social" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={(event) => save("social", event)} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          {(["facebook_url", "instagram_url", "tiktok_url", "youtube_url"] as const).map((name) => <label key={name} className={label}>{name.replace("_url", "")}<input type="url" className={input} name={name} defaultValue={settings[name] ?? ""} placeholder="https://" /></label>)}
          <div className="sm:col-span-2">{submit}</div>
        </form>
      </Tabs.Content>
      <Tabs.Content value="appearance" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={(event) => save("appearance", event)} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          {([["logo", logo, setLogo], ["favicon", favicon, setFavicon]] as const).map(([field, value, setValue]) => <div key={field} className={label}>
            <label>{field === "logo" ? "Логотип" : "Favicon"} (шлях у site-media)<input className={input} name={`${field}_path`} value={value} onChange={(event) => setValue(event.target.value)} /></label>
            <label>Завантажити зображення<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} className={input} onChange={(event) => { upload(event.target.files?.[0], field); event.target.value = ""; }} /></label>
          </div>)}
          <label className={`${label} sm:col-span-2`}>Текст оголошення<input className={input} name="announcement_text" maxLength={500} defaultValue={settings.announcement_text ?? ""} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="announcement_enabled" defaultChecked={settings.announcement_enabled} /> Показувати оголошення</label>
          <div className="sm:col-span-2">{submit}</div>
        </form>
      </Tabs.Content>
      <Tabs.Content value="behavior" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={(event) => save("behavior", event)} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <label className={label}>Поріг низького залишку<input type="number" min="0" max="1000000" step="1" className={input} name="low_stock_threshold" defaultValue={settings.low_stock_threshold} required /></label>
          <p className="sm:col-span-2 text-sm text-slate-600">Режим обслуговування та доступність замовлень ще не підключені.</p>
          <div className="sm:col-span-2">{submit}</div>
        </form>
      </Tabs.Content>
      <Tabs.Content value="notifications" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={(event) => save("notifications", event)} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <label className={label}>Email для сповіщень продавцю<input type="email" className={input} name="seller_notification_email" defaultValue={settings.seller_notification_email ?? ""} /></label>
          <p className="text-sm text-slate-600">Якщо адресу не вказано, використовується SELLER_EMAIL із серверного середовища.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="customer_email_notifications" defaultChecked={settings.customer_email_notifications} /> Підтвердження замовлення клієнту</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="order_status_notifications" defaultChecked={settings.order_status_notifications} /> Дозволити сповіщення про статус замовлення</label>
          <div className="sm:col-span-2">{submit}</div>
        </form>
      </Tabs.Content>
      <Tabs.Content value="legal" forceMount className="mt-4 data-[state=inactive]:hidden">
        <form onSubmit={(event) => save("legal", event)} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
          <label className={label}>Назва компанії<input className={input} name="company_name" defaultValue={settings.company_name ?? ""} maxLength={200} /></label>
          <label className={label}>Адреса<input className={input} name="business_address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={500} /></label>
          <label className={label}>NIP<input className={input} name="nip" defaultValue={settings.nip ?? ""} maxLength={100} /></label>
          <label className={label}>REGON<input className={input} name="regon" defaultValue={settings.regon ?? ""} maxLength={100} /></label>
          <label className={label}>Інформація про VAT<input className={input} name="vat_details" defaultValue={settings.vat_details ?? ""} maxLength={500} /></label>
          <label className={label}>Адреса повернення<input className={input} name="return_address" defaultValue={settings.return_address ?? ""} maxLength={500} /></label>
          <div className="sm:col-span-2">{submit}</div>
        </form>
      </Tabs.Content>
    </Tabs.Root>
    <p className="text-sm text-slate-600">Налаштування доставки ще не підключено до цього редактора.</p>
  </div>;
}

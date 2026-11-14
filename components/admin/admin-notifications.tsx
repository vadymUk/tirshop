"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Popover } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadNotifications, markNotificationsRead, saveNotificationPreferences } from "@/lib/admin/notification-actions";
import { notificationKinds, notificationLabels, notificationLink, type NotificationFeed, type NotificationPreferences } from "@/lib/admin/notifications";

const PAGE_SIZE = 10;

export function AdminNotifications() {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      const result = await loadNotifications(offset);
      if (current === request.current) {
        setFeed(result);
        setError("");
      }
    } catch (reason) {
      console.error("Notification refresh failed:", reason);
      if (current === request.current) setError("Не вдалося оновити сповіщення. Перевірте з’єднання.");
    }
  }, [offset]);

  useEffect(() => {
    const requestRef = request;
    let active = true;
    let running = false;
    let timer: number;
    const poll = async () => {
      if (running) return;
      running = true;
      await refresh();
      running = false;
      if (active) timer = window.setTimeout(() => { void poll(); }, 30_000);
    };
    const online = () => {
      window.clearTimeout(timer);
      void poll();
    };
    const offline = () => setError("Немає з’єднання. Оновлення відновиться автоматично.");
    timer = window.setTimeout(() => { void poll(); }, 0);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      ++requestRef.current;
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [refresh]);

  async function markRead(id: string | null) {
    setBusy(true);
    try {
      await markNotificationsRead(id);
      await refresh();
      return true;
    } catch (reason) {
      console.error("Marking notifications failed:", reason);
      setError("Не вдалося позначити сповіщення прочитаними.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    if (!draft) return;
    setBusy(true);
    try {
      await saveNotificationPreferences(draft);
      setDraft(null);
      setOffset(0);
      await refresh();
    } catch (reason) {
      console.error("Saving notification preferences failed:", reason);
      setError("Не вдалося зберегти налаштування.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="relative flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
          aria-label={error ? "Сповіщення, помилка оновлення" : feed ? `Сповіщення, непрочитаних: ${feed.unread}` : "Сповіщення"}>
          <Bell aria-hidden="true" className="size-5" />
          {feed && feed.unread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 rounded-full bg-red-700 px-1 text-[10px] font-bold text-white">{feed.unread > 99 ? "99+" : feed.unread}</span>}
          {error && <span aria-hidden="true" className="absolute bottom-1 right-0 size-2 rounded-full bg-red-700" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} aria-label="Сповіщення адміністратора"
          className="z-50 max-h-[min(80vh,40rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-950">Сповіщення</h2>
            <Popover.Close className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100" aria-label="Закрити сповіщення">✕</Popover.Close>
          </div>
          {error && <p role="alert" className="mt-2 text-red-700">{error} <button type="button" onClick={() => void refresh()} className="underline">Повторити</button></p>}
          {!feed && !error && <p role="status" className="mt-3">Завантаження…</p>}
          {feed && (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span aria-live="polite">Непрочитаних: {feed.unread}</span>
                <button type="button" disabled={busy || feed.unread === 0} onClick={() => void markRead(null)} className="text-blue-700 underline disabled:text-slate-400">Прочитати всі</button>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {feed.items.slice(0, PAGE_SIZE).map((item) => (
                  <li key={item.id} className="flex items-start gap-2 py-3">
                    <span aria-label={item.is_read ? "Прочитано" : "Непрочитано"} className={`mt-1.5 size-2 shrink-0 rounded-full ${item.is_read ? "bg-slate-300" : "bg-blue-600"}`} />
                    <div className="min-w-0 flex-1">
                      <Link href={notificationLink(item)} onClick={() => { setOpen(false); if (!item.is_read) void markRead(item.id); }}
                        className="font-medium text-blue-700 hover:underline">{notificationLabels[item.kind]}</Link>
                      <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("uk-UA")}</p>
                    </div>
                    {!item.is_read && <button type="button" disabled={busy} onClick={() => void markRead(item.id)} className="text-xs text-blue-700 underline disabled:text-slate-400">Прочитано</button>}
                  </li>
                ))}
              </ul>
              {feed.items.length === 0 && <p className="py-4 text-slate-500">Сповіщень немає.</p>}
              <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                <button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} className="text-blue-700 underline disabled:text-slate-400">Новіші</button>
                <button type="button" disabled={feed.items.length <= PAGE_SIZE} onClick={() => setOffset((value) => value + PAGE_SIZE)} className="text-blue-700 underline disabled:text-slate-400">Старіші</button>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                {!draft ? (
                  <button type="button" onClick={() => setDraft(feed.preferences)} className="text-blue-700 underline">Налаштувати сповіщення</button>
                ) : (
                  <fieldset>
                    <legend className="font-semibold text-slate-900">Типи сповіщень</legend>
                    {notificationKinds.map((kind) => (
                      <label key={kind} className="mt-2 flex items-center gap-2">
                        <input type="checkbox" checked={draft[kind]} onChange={(event) => setDraft({ ...draft, [kind]: event.target.checked })} />
                        {notificationLabels[kind]}
                      </label>
                    ))}
                    <div className="mt-3 flex gap-3">
                      <button type="button" disabled={busy} onClick={() => void savePreferences()} className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">Зберегти</button>
                      <button type="button" disabled={busy} onClick={() => setDraft(null)} className="px-2 text-blue-700 underline">Скасувати</button>
                    </div>
                  </fieldset>
                )}
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

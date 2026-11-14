"use client";

import { useActionState } from "react";
import { saveOrderDetails, transitionOrder, type OrderActionState } from "@/lib/admin/order-actions";
import { statusLabels, transitions } from "@/lib/admin/order-validation";
import type { Database, OrderStatus } from "@/types/database";

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
function Result({ state }: { state: OrderActionState }) {
  return <>{state.error && <p role="alert" className="text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-green-700">{state.success}</p>}{state.warning && <p role="alert" className="text-amber-700">{state.warning}</p>}</>;
}

export function OrderStatusForm({ id, status }: { id: string; status: OrderStatus }) {
  const [state, action, pending] = useActionState(transitionOrder, {});
  return <form action={action} onSubmit={(event) => {
    const data = new FormData(event.currentTarget);
    if (data.get("status") === "cancelled" && !window.confirm("Скасувати замовлення та повернути залишки на склад? Оплата не повертається автоматично.")) event.preventDefault();
  }} className="space-y-3 rounded-xl border bg-white p-4 text-sm">
    <h2 className="font-semibold">Змінити статус</h2><input type="hidden" name="id" value={id} /><input type="hidden" name="expected" value={status} />
    {transitions[status].length ? <><label className="block">Новий статус<select name="status" className={field} required defaultValue=""><option value="" disabled>Оберіть статус</option>{transitions[status].map((s) => <option value={s} key={s}>{statusLabels[s]}</option>)}</select></label>
      <label className="block">Внутрішня примітка до історії<textarea name="note" maxLength={1000} className={field} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" name="notify" /> Повідомити клієнта електронною поштою</label>
      <button disabled={pending} className="min-h-10 rounded bg-slate-900 px-4 text-white">Змінити статус</button></> : <p>Подальші переходи недоступні.</p>}
    <Result state={state} />
  </form>;
}

export function OrderPrivateForm({ id, details }: { id: string; details: Database["public"]["Tables"]["order_admin_details"]["Row"] | null }) {
  const [state, action, pending] = useActionState(saveOrderDetails, {});
  return <form action={action} className="space-y-3 rounded-xl border bg-white p-4 text-sm">
    <h2 className="font-semibold">Внутрішні дані</h2><input type="hidden" name="id" value={id} />
    <label className="block">Перевізник<input name="shipping_provider" maxLength={120} className={field} defaultValue={details?.shipping_provider ?? ""} /></label>
    <label className="block">Номер відстеження<input name="tracking_number" maxLength={200} className={field} defaultValue={details?.tracking_number ?? ""} /></label>
    <label className="block">Внутрішня примітка<textarea name="internal_note" maxLength={5000} className={field} defaultValue={details?.internal_note ?? ""} /></label>
    <p className="text-slate-500">Ці дані доступні лише активним адміністраторам.</p>
    <button disabled={pending} className="min-h-10 rounded bg-slate-900 px-4 text-white">Зберегти</button><Result state={state} />
  </form>;
}

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="min-h-10 rounded bg-slate-900 px-4 text-white print:hidden">Друк / зберегти PDF</button>;
}

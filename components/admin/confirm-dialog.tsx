"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";

export function ConfirmDialog({ trigger, title, description, confirmLabel, onConfirm, destructive = false }: { trigger: ReactNode; title: string; description: string; confirmLabel: string; onConfirm: () => void; destructive?: boolean }) {
  return <AlertDialog.Root><AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" /><AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 text-slate-900 shadow-xl"><AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title><AlertDialog.Description className="mt-2 text-sm text-slate-600">{description}</AlertDialog.Description><div className="mt-6 flex flex-wrap justify-end gap-2"><AlertDialog.Cancel className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm">Скасувати</AlertDialog.Cancel><AlertDialog.Action onClick={onConfirm} className={`min-h-10 rounded-lg px-4 text-sm font-medium text-white ${destructive ? "bg-red-700" : "bg-slate-900"}`}>{confirmLabel}</AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}

export function DeleteDialog(props: Omit<React.ComponentProps<typeof ConfirmDialog>, "confirmLabel" | "destructive">) {
  return <ConfirmDialog {...props} confirmLabel="Видалити" destructive />;
}

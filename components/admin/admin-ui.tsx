import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, Inbox, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function AdminPageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-700">Керування магазином</p><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div>{action}</div>;
}

export function AdminStatsCard({ label, value, icon: Icon, detail }: { label: string; value: string | number; icon: React.ElementType; detail?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Icon className="size-5" /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>{detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}</div>;
}

export function EmptyState({ title = "Немає записів", description = "Дані з’являться тут, коли їх буде додано." }: { title?: string; description?: string }) {
  return <div className="flex flex-col items-center px-5 py-14 text-center"><span className="rounded-full bg-slate-100 p-3 text-slate-500"><Inbox className="size-6" /></span><h2 className="mt-4 font-semibold text-slate-900">{title}</h2><p className="mt-1 max-w-md text-sm text-slate-500">{description}</p></div>;
}

export function ErrorState({ reset }: { reset?: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-white p-8 text-center"><AlertCircle className="mx-auto size-7 text-red-600" /><h2 className="mt-3 font-semibold text-slate-900">Не вдалося завантажити дані</h2><p className="mt-1 text-sm text-slate-500">Перевірте з’єднання та спробуйте ще раз.</p>{reset && <button type="button" onClick={reset} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Спробувати знову</button>}</div>;
}

export function LoadingSkeleton() {
  return <div role="status" aria-label="Завантаження" className="space-y-5"><div className="h-8 w-56 animate-pulse rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />)}</div><div className="h-64 animate-pulse rounded-xl bg-slate-200" /></div>;
}

export function AdminSearch({ query, placeholder = "Пошук..." }: { query: string; placeholder?: string }) {
  return <form className="w-full sm:max-w-sm"><label className="relative block"><span className="sr-only">{placeholder}</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input name="q" defaultValue={query} placeholder={placeholder} className="border-slate-200 bg-white pl-9 text-slate-900" /></label></form>;
}

export function AdminFilters({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">{children}</div>;
}

export function AdminFormField({ label, htmlFor, children, error }: { label: string; htmlFor: string; children: ReactNode; error?: string }) {
  return <div className="space-y-1.5"><label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">{label}</label>{children}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}

export type AdminRow = { id: string; cells: string[]; href?: string };

export function AdminDataTable({ columns, rows }: { columns: string[]; rows: AdminRow[] }) {
  if (!rows.length) return <EmptyState />;
  return <>
    <div className="hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th key={column} scope="col" className="px-5 py-3">{column}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">{row.cells.map((cell, index) => <td key={columns[index]} className={cn("max-w-72 break-words px-5 py-4 text-slate-600", index === 0 && "font-medium text-slate-900")}>{index === 0 && row.href ? <Link href={row.href} className="text-blue-700 hover:underline">{cell}</Link> : cell}</td>)}</tr>)}</tbody></table></div>
    <div className="divide-y divide-slate-100 sm:hidden">{rows.map((row) => <div key={row.id} className="space-y-2 p-4">{row.cells.map((cell, index) => <div key={columns[index]} className="flex min-w-0 justify-between gap-4 text-sm"><span className="shrink-0 text-slate-500">{columns[index]}</span><span className="min-w-0 break-words text-right font-medium text-slate-900">{index === 0 && row.href ? <Link className="text-blue-700 underline" href={row.href}>{cell}</Link> : cell}</span></div>)}</div>)}</div>
  </>;
}

export function AdminPagination({ page, hasNext, query }: { page: number; hasNext: boolean; query: string }) {
  const link = (number: number) => `?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(number) })}`;
  const button = "inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50";
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4"><span className="text-sm text-slate-500">Сторінка {page}</span><div className="flex gap-2">{page > 1 && <Link href={link(page - 1)} className={button}><ArrowLeft className="size-4" /> Назад</Link>}{hasNext && <Link href={link(page + 1)} className={button}>Далі <ArrowRight className="size-4" /></Link>}</div></div>;
}

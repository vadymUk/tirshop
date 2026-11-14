import { z } from "zod";
import { validDate } from "@/lib/admin/overview";
import type { Json } from "@/types/database";

export type ActivityFilter = { admin: string; action: string; entity: string; from: string; to: string; query: string; page: number };
export type ActivityRow = { id: string; admin_user_id: string | null; action: string; entity_type: string; entity_id: string | null; description: string | null; metadata: Json; created_at: string };
export const activityPageSize = 20;

export function parseActivityFilter(input: Record<string, string | string[] | undefined>): { filter?: ActivityFilter; error?: string } {
  const { admin = "", action = "", entity = "", from = "", to = "", q = "", page = "1" } = input;
  if ([admin, action, entity, from, to, q, page].some((value) => typeof value !== "string")) return { error: "Некоректні параметри фільтра." };
  if (typeof admin !== "string" || typeof action !== "string" || typeof entity !== "string" || typeof from !== "string" || typeof to !== "string" || typeof q !== "string" || typeof page !== "string") return { error: "Некоректні параметри фільтра." };
  if (admin && !z.string().uuid().safeParse(admin).success) return { error: "Вкажіть коректний ID адміністратора." };
  if (action.length > 100 || entity.length > 100 || q.trim().length > 100) return { error: "Фільтри можуть містити до 100 символів." };
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) return { error: "Вкажіть коректний діапазон дат." };
  if (!/^[1-9]\d{0,6}$/.test(page)) return { error: "Некоректна сторінка." };
  return { filter: { admin, action: action.trim(), entity: entity.trim(), from, to, query: q.trim(), page: Number(page) } };
}

export function activityCsv(rows: ActivityRow[], firstPage: boolean) {
  const values: string[][] = firstPage ? [["administrator_id", "action", "entity_type", "entity_id", "description", "metadata", "timestamp_utc"]] : [];
  for (const row of rows) values.push([row.admin_user_id ?? "", row.action, row.entity_type, row.entity_id ?? "", row.description ?? "", JSON.stringify(row.metadata), row.created_at]);
  const result = values.map((row) => row.map((value) => {
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  return (firstPage ? "\uFEFF" : "") + (result ? `${result}\r\n` : "");
}

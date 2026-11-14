export function parseAdminListParams(params: { q?: string | string[]; page?: string | string[] }) {
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const rawPage = typeof params.page === "string" ? params.page : "1";
  const number = /^\d{1,5}$/.test(rawPage) ? Number(rawPage) : 1;
  return { query, page: Math.max(1, number) };
}

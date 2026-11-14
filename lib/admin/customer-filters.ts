export type CustomerParams = Record<string, string | string[] | undefined>;

export function parseCustomerFilters(raw: CustomerParams) {
  const get = (key: string) => typeof raw[key] === "string" ? raw[key] as string : "";
  const date = (key: string) => {
    const value = get(key);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
  };
  const count = (key: string) => /^\d{1,8}$/.test(get(key)) ? Number(get(key)) : null;
  const page = /^\d{1,5}$/.test(get("page")) ? Math.max(1, Number(get("page"))) : 1;
  return { query: get("q").trim().slice(0, 100), from: date("from"), to: date("to"),
    min: count("min"), max: count("max"), ascending: get("sort") === "asc", page };
}

export function customerDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

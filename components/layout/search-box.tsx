"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { MAX_SEARCH_LENGTH } from "@/lib/catalog/config";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/layout/language-provider";

const DEBOUNCE_MS = 400;

export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const inputId = useId();
  const { t } = useLanguage();

  const [value, setValue] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();
  const [pushed, setPushed] = useState(urlQuery);

  // Follow external URL changes (reset links, back button) without clobbering what the user is typing.
  if (urlQuery !== syncedUrlQuery) {
    setSyncedUrlQuery(urlQuery);
    if (urlQuery !== pushed) setValue(urlQuery);
    setPushed(urlQuery);
  }

  function navigate(next: string) {
    const term = next.replace(/\s+/g, " ").trim();
    if (term === pushed) return;

    const onProducts = pathname === "/products";
    // Outside /products an empty query has nowhere to go.
    if (!term && !onProducts) return;

    setPushed(term);
    const params = new URLSearchParams(onProducts ? searchParams.toString() : "");
    params.delete("page");
    if (term) params.set("q", term);
    else params.delete("q");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/products?${query}` : "/products", { scroll: false });
    });
  }

  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    const timer = setTimeout(() => navigateRef.current(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <form
      role="search"
      aria-label={t("Пошук товарів")}
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(value);
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {t("Пошук товарів")}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={inputId}
        type="search"
        name="q"
        value={value}
        maxLength={MAX_SEARCH_LENGTH}
        onChange={(event) => setValue(event.target.value)}
        placeholder={`${t("Пошук товарів")}…`}
        autoComplete="off"
        enterKeyHint="search"
        className="h-10 w-full rounded-md border bg-background pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2" aria-live="polite">
        {isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : value ? (
          <button
            type="button"
            aria-label={t("Очистити пошук")}
            onClick={() => setValue("")}
            className="rounded p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        {isPending && <span className="sr-only">{t("Пошук товарів")}…</span>}
      </span>
    </form>
  );
}

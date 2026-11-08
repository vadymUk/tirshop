"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/components/layout/use-hydrated";
import { useLanguage } from "@/components/layout/language-provider";

export type HeaderCategory = { id: string; name: string; slug: string };

const itemClass =
  "block cursor-pointer rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent";

export function CategoriesMenu({ categories }: { categories: HeaderCategory[] }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const isHydrated = useHydrated();
  const active = isHydrated && pathname.startsWith("/category/");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent",
          active && "bg-secondary font-medium",
        )}
      >
        {t("Категорії")}
        <ChevronDown className="size-4" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[70vh] min-w-56 overflow-y-auto rounded-md border bg-background p-1 text-foreground shadow-md"
        >
          {categories.map((category) => (
            <DropdownMenu.Item key={category.id} asChild>
              <Link
                href={`/category/${category.slug}`}
                aria-current={
                  isHydrated && pathname === `/category/${category.slug}`
                    ? "page"
                    : undefined
                }
                className={itemClass}
              >
                {t(category.name)}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link href="/products" className={itemClass}>
              {t("Усі товари")}
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

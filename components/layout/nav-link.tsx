"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHydrated } from "@/components/layout/use-hydrated";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  href: string;
  /** Path prefix that also marks the link active (e.g. /products/[slug]). */
  matchPrefix?: boolean;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
};

export function NavLink({
  href,
  matchPrefix = false,
  className,
  activeClassName = "bg-secondary font-medium",
  children,
}: NavLinkProps) {
  const pathname = usePathname();
  const isHydrated = useHydrated();
  const active = isHydrated && (matchPrefix
    ? pathname === href || pathname.startsWith(`${href}/`)
    : pathname === href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        className,
        active && activeClassName,
      )}
    >
      {children}
    </Link>
  );
}

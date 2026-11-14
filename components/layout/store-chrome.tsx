"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function StoreChrome({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return children;

  return (
    <>
      {header}
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
      {footer}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Menu, Search, Store, X } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { adminLinks, adminNavigation } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";

function Navigation({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Навігація адміністратора" className="space-y-5">
      {adminNavigation.map((group) => (
        <div key={group.title}>
          {!collapsed && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>}
          <div className="space-y-1">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link key={href} href={href} onClick={onNavigate} title={collapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600", active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950", collapsed && "justify-center px-2")}>
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] md:flex print:hidden", collapsed ? "w-20" : "w-64")}>
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Store className="size-5" /></span>
        {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">TIR Shop</p><p className="text-xs text-slate-500">Панель керування</p></div>}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5"><Navigation collapsed={collapsed} /></div>
      <button type="button" onClick={onToggle} className="m-3 flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50" aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}>
        {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /> Згорнути меню</>}
      </button>
    </aside>
  );
}

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const section = adminLinks.find((item) => item.href === `/admin/${parts[1]}`);
  return (
    <nav aria-label="Навігаційний шлях" className="hidden min-w-0 items-center gap-2 text-sm text-slate-500 sm:flex">
      <Link href="/admin" className="hover:text-slate-900">Адмін</Link>
      {section && <><span aria-hidden="true">/</span><Link href={section.href} className="truncate hover:text-slate-900">{section.label}</Link></>}
      {parts.length > 2 && <><span aria-hidden="true">/</span><span className="truncate text-slate-900">{parts[2] === "new" ? "Новий" : parts[3] === "edit" ? "Редагування" : "Деталі"}</span></>}
    </nav>
  );
}

export function AdminHeader({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 print:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild><button type="button" className="flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden" aria-label="Відкрити меню"><Menu className="size-5" /></button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(85vw,18rem)] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <Dialog.Title className="font-bold text-slate-900">TIR Shop · Адмін</Dialog.Title>
              <Dialog.Close asChild><button type="button" className="flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="Закрити меню"><X className="size-5" /></button></Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Навігація панеллю керування</Dialog.Description>
            <div className="overflow-y-auto px-3 py-5"><Navigation onNavigate={() => setOpen(false)} /></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AdminBreadcrumbs />
      <span className="text-sm font-bold text-slate-900 sm:hidden">TIR Shop</span>
      <div className="ml-auto flex items-center gap-2">
        <form action="/admin/products" className="hidden lg:block">
          <label className="relative block"><span className="sr-only">Пошук товарів</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input name="q" placeholder="Пошук товарів..." className="h-10 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" /></label>
        </form>
        <AdminNotifications />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button type="button" className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left hover:bg-slate-100" aria-label="Меню профілю адміністратора"><span className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{email.charAt(0).toUpperCase() || "A"}</span><span className="hidden max-w-36 truncate text-sm font-medium text-slate-700 xl:block">{email}</span><ChevronDown className="hidden size-4 text-slate-400 sm:block" /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg">
            <p className="truncate px-2 py-2 font-medium">{email}</p>
            <DropdownMenu.Item asChild><Link href="/" className="flex items-center gap-2 rounded-md px-2 py-2 outline-none hover:bg-slate-100 focus:bg-slate-100"><ExternalLink className="size-4" /> Перейти до магазину</Link></DropdownMenu.Item>
            <div className="border-t border-slate-100 pt-2"><SignOutButton variant="ghost" className="w-full justify-start text-slate-700">Вийти</SignOutButton></div>
          </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900" style={{ colorScheme: "light" }}>
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="min-w-0 flex-1">
        <AdminHeader email={email} />
        <main id="main" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}

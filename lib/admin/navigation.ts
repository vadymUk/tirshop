import {
  Activity, BarChart3, FileText, FolderTree, Image, LayoutDashboard,
  LayoutPanelTop, Megaphone, Package, SearchCheck, Settings, ShoppingCart,
  Users, UserRoundCog, Warehouse,
} from "lucide-react";

export const adminNavigation = [
  { title: "Огляд", items: [
    { href: "/admin", label: "Панель керування", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Аналітика", icon: BarChart3 },
  ] },
  { title: "Магазин", items: [
    { href: "/admin/products", label: "Товари", icon: Package },
    { href: "/admin/categories", label: "Категорії", icon: FolderTree },
    { href: "/admin/orders", label: "Замовлення", icon: ShoppingCart },
    { href: "/admin/customers", label: "Клієнти", icon: Users },
    { href: "/admin/inventory", label: "Склад", icon: Warehouse },
  ] },
  { title: "Контент", items: [
    { href: "/admin/media", label: "Медіа", icon: Image },
    { href: "/admin/banners", label: "Банери", icon: Megaphone },
    { href: "/admin/homepage", label: "Головна сторінка", icon: LayoutPanelTop },
    { href: "/admin/pages", label: "Сторінки", icon: FileText },
    { href: "/admin/seo", label: "SEO", icon: SearchCheck },
  ] },
  { title: "Система", items: [
    { href: "/admin/settings", label: "Налаштування", icon: Settings },
    { href: "/admin/activity", label: "Журнал дій", icon: Activity },
    { href: "/admin/team", label: "Команда", icon: UserRoundCog },
  ] },
];

export const adminLinks = adminNavigation.flatMap((group) => group.items);

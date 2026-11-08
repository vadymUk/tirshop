import type { Metadata } from "next";
import { FavoritesList } from "@/components/catalog/favorites-list";
import { requireUser } from "@/lib/auth/session";
import { getFavoriteProducts } from "@/lib/db/queries/products";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

export const metadata: Metadata = {
  title: "Favorites",
  robots: { index: false },
};

export default async function FavoritesPage() {
  await requireUser("/favorites");
  const [products, language] = await Promise.all([getFavoriteProducts(), getLanguage()]);
  const t = (source: string) => translate(language, source);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Обране")}</h1>
      <FavoritesList products={products} />
    </div>
  );
}

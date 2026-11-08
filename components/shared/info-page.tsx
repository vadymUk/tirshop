import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { translate } from "@/lib/translations";

/** Layout for informational pages whose final text is not provided yet. */
export async function InfoPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children?: React.ReactNode;
}) {
  const language = await getLanguage();
  const t = (source: string) => translate(language, source);
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{t(title)}</h1>
      <p className="text-muted-foreground">{t(intro)}</p>
      {children}
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {t("Повний текст цієї сторінки буде додано пізніше. З питань щодо замовлення зверніться до продавця.")}
      </div>
      <Link href="/about#contacts" className={cn(buttonVariants({ variant: "outline" }))}>
        {t("Зв'язатися з продавцем")}
      </Link>
    </article>
  );
}

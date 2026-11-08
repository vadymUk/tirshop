import { Fragment } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLanguage } from "@/lib/i18n";
import { legalContent, legalUi, type LegalPageId } from "@/lib/legal-content";

/** Renders [[placeholder]] segments as highlighted marks the owner must replace. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[\[.*?\]\])/g).map((part, index) =>
        part.startsWith("[[") && part.endsWith("]]") ? (
          <mark
            key={index}
            className="rounded bg-amber-200 px-1 font-medium text-amber-950 dark:bg-amber-500/30 dark:text-amber-100"
          >
            {part.slice(2, -2)}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export async function legalTitle(page: LegalPageId) {
  const language = await getLanguage();
  return legalContent[page][language].title;
}

export async function LegalPage({ page }: { page: LegalPageId }) {
  const language = await getLanguage();
  const content = legalContent[page][language];
  const ui = legalUi[language];

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{content.title}</h1>
        <p className="text-muted-foreground">{content.intro}</p>
        <p className="text-sm text-muted-foreground">
          {ui.lastUpdated} <RichText text="[[ДАТА / DATA]]" />
        </p>
      </header>

      <aside
        role="note"
        className="rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"
      >
        <p className="font-semibold">{ui.draftTitle}</p>
        <p className="mt-1">
          <RichText text={ui.draftBody} />
        </p>
      </aside>

      {content.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index} className="leading-relaxed text-muted-foreground">
              <RichText text={paragraph} />
            </p>
          ))}
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{ui.contactTitle}</h2>
        <p className="text-muted-foreground">
          <RichText text={ui.contactBody} />
        </p>
        <Link href="/about#contacts" className={cn(buttonVariants({ variant: "outline" }))}>
          {ui.contactTitle}
        </Link>
      </section>
    </article>
  );
}

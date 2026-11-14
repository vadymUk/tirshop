"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { ConfirmDialog, DeleteDialog } from "@/components/admin/confirm-dialog";
import { uploadMedia } from "@/lib/admin/media-actions";
import { operatePage, publishPage, savePageDraft } from "@/lib/admin/page-actions";
import { mediaUrl } from "@/lib/admin/media-shared";
import { safeLink } from "@/lib/homepage/schema";
import { type PageDocument } from "@/lib/pages/schema";

const input = "min-h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm";
const label = "flex min-w-0 flex-col gap-1 text-sm font-medium";
const button = "min-h-10 rounded border px-3 py-2 text-sm disabled:opacity-50";

export function PageEditor({ id, document: initial, revision: initialRevision, published: initialPublished }: {
  id: string; document: PageDocument; revision: number; published: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [document, setDocument] = useState(initial);
  const [revision, setRevision] = useState(initialRevision);
  const [published, setPublished] = useState(initialPublished);
  const [dirty, setDirty] = useState(!initialRevision);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [pending, startTransition] = useTransition();
  const change = (patch: Partial<PageDocument>) => { setDocument((current) => ({ ...current, ...patch })); setDirty(true); setMessage(""); };
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, code: false, codeBlock: false, horizontalRule: false, strike: false, underline: false, link: { openOnClick: false, autolink: false, linkOnPaste: false } }),
      Image.configure({ allowBase64: false }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
    ],
    content: initial.content,
    editorProps: { attributes: { role: "textbox", "aria-label": "Вміст сторінки", "aria-multiline": "true", class: "min-h-64 p-4 focus:outline-2 focus:outline-blue-700" } },
    onUpdate: ({ editor: current }) => change({ content: current.getJSON() }),
  });
  useEffect(() => { editor?.setEditable(!pending, false); }, [editor, pending]);
  const run = (action: () => Promise<void>) => startTransition(async () => {
    try { setError(""); setMessage(""); await action(); }
    catch (e) { setError(e instanceof Error ? e.message : "Операцію не виконано."); }
  });
  const save = async () => {
    const next = await savePageDraft(id, document, revision);
    setRevision(next); setDirty(false);
    if (pathname === "/admin/pages/new") router.replace(`/admin/pages/${id}`);
    return next;
  };
  const upload = (file: File | undefined, target: "featured_image_path" | "og_image_path" | "content") => {
    if (!file) return;
    if (target === "content" && !imageAlt.trim()) { setError("Вкажіть альтернативний текст зображення перед завантаженням."); return; }
    run(async () => {
      const form = new FormData(); form.set("file", file); form.set("bucket", "site-media");
      const { path } = await uploadMedia(form);
      if (target === "content") {
        if (!editor) throw new Error("Редактор ще не готовий. Файл збережено в медіатеці.");
        editor.chain().focus().setImage({ src: mediaUrl("site-media", path), alt: imageAlt.trim() }).run();
        setImageAlt("");
      } else change({ [target]: path });
      setMessage("Зображення завантажено.");
    });
  };
  const toolbar = (title: string, command: () => void, active = false) => <button type="button" className={`${button} ${active ? "bg-blue-100" : "bg-white"}`} aria-pressed={active} disabled={pending || !editor} onMouseDown={(e) => e.preventDefault()} onClick={command}>{title}</button>;
  return <div className="space-y-4">
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-sm">
      <button type="button" disabled={pending} className={`${button} bg-slate-900 text-white`} onClick={() => run(async () => { await save(); setMessage("Чернетку збережено."); })}>Зберегти чернетку</button>
      {revision && !dirty ? <Link className={button} href={`/admin/pages/${id}/preview`} target="_blank">Попередній перегляд</Link> : <span className={`${button} opacity-50`}>Збережіть для перегляду</span>}
      <ConfirmDialog trigger={<button type="button" disabled={pending} className={`${button} bg-blue-700 text-white`}>Опублікувати</button>} title="Опублікувати сторінку?" description="Опублікована версія буде замінена збереженою чернеткою." confirmLabel="Опублікувати" onConfirm={() => run(async () => { const next = dirty || !revision ? await save() : revision; await publishPage(id, next); setPublished(true); setMessage("Сторінку опубліковано."); router.refresh(); })} />
      {published && <ConfirmDialog trigger={<button type="button" disabled={pending} className={button}>Зняти з публікації</button>} title="Зняти сторінку з публікації?" description="Сторінка перестане бути доступною відвідувачам; чернетку буде збережено." confirmLabel="Зняти" onConfirm={() => run(async () => { await operatePage(id, "unpublish"); setPublished(false); setMessage("Сторінку знято з публікації."); router.refresh(); })} />}
      {(revision > 0 || published) && <DeleteDialog trigger={<button type="button" disabled={pending} className={`${button} text-red-700`}>Видалити</button>} title="Видалити сторінку?" description="Чернетку та опубліковану версію буде видалено." onConfirm={() => run(async () => { await operatePage(id, "delete"); router.push("/admin/pages"); router.refresh(); })} />}
      <span className="text-sm text-slate-600">{published ? "Опубліковано" : "Не опубліковано"} · {dirty ? "Є незбережені зміни" : `Чернетка №${revision}`}</span>
    </div>
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {error && <p role="alert" className="break-words rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <fieldset disabled={pending} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
      <label className={label}>Заголовок<input className={input} value={document.title} maxLength={200} onChange={(e) => change({ title: e.target.value })} /></label>
      <label className={label}>Slug (латиниця, цифри та дефіси)<input className={input} value={document.slug} maxLength={100} onChange={(e) => change({ slug: e.target.value })} /></label>
      <label className={`${label} sm:col-span-2`}>Короткий опис<textarea className={input} value={document.excerpt} maxLength={500} onChange={(e) => change({ excerpt: e.target.value })} /></label>
      <label className={label}>SEO заголовок<input className={input} value={document.meta_title} maxLength={200} onChange={(e) => change({ meta_title: e.target.value })} /></label>
      <label className={label}>Canonical URL (https або шлях сайту)<input className={input} value={document.canonical_url} onChange={(e) => change({ canonical_url: e.target.value })} /></label>
      <label className={`${label} sm:col-span-2`}>SEO опис<textarea className={input} value={document.meta_description} maxLength={500} onChange={(e) => change({ meta_description: e.target.value })} /></label>
      <label className={label}>Дата публікації (UTC, порожнє — одразу)<input type="datetime-local" className={input} value={document.published_at.slice(0, 16)} onChange={(e) => change({ published_at: e.target.value ? `${e.target.value}:00.000Z` : "" })} /></label>
      {(["featured_image_path", "og_image_path"] as const).map((field) => <div key={field} className={label}>
        <label>{field === "featured_image_path" ? "Головне зображення" : "Зображення Open Graph"}<input type="file" accept="image/jpeg,image/png,image/webp" className={`${input} mt-1`} onChange={(e) => { upload(e.target.files?.[0], field); e.target.value = ""; }} /></label>
        <label>Шлях у медіатеці<input className={input} value={document[field]} onChange={(e) => change({ [field]: e.target.value })} /></label>
      </div>)}
    </fieldset>
    <section aria-labelledby="editor-heading" className="rounded-xl border bg-white p-4">
      <h2 id="editor-heading" className="mb-3 text-xl font-bold">Вміст сторінки</h2>
      <div role="group" aria-label="Форматування тексту" className="flex flex-wrap gap-2">
        {toolbar("Абзац", () => editor?.chain().focus().setParagraph().run(), editor?.isActive("paragraph"))}
        {[2, 3, 4].map((level) => <span key={level}>{toolbar(`Заголовок ${level}`, () => editor?.chain().focus().toggleHeading({ level: level as 2 | 3 | 4 }).run(), editor?.isActive("heading", { level }))}</span>)}
        {toolbar("Жирний", () => editor?.chain().focus().toggleBold().run(), editor?.isActive("bold"))}
        {toolbar("Курсив", () => editor?.chain().focus().toggleItalic().run(), editor?.isActive("italic"))}
        {toolbar("Маркований список", () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive("bulletList"))}
        {toolbar("Нумерований список", () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive("orderedList"))}
        {toolbar("Цитата", () => editor?.chain().focus().toggleBlockquote().run(), editor?.isActive("blockquote"))}
        {toolbar("Таблиця", () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
        {toolbar("Додати рядок", () => editor?.chain().focus().addRowAfter().run())}
        {toolbar("Додати стовпець", () => editor?.chain().focus().addColumnAfter().run())}
        {toolbar("Видалити таблицю", () => editor?.chain().focus().deleteTable().run())}
      </div>
      <div className="my-3 flex flex-wrap items-end gap-2">
        <label className={`${label} min-w-52 flex-1`}>Посилання (https або шлях сайту)<input className={input} disabled={pending} value={link} onChange={(e) => setLink(e.target.value)} /></label>
        <button type="button" disabled={pending || !editor} className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (!link || !safeLink.safeParse(link).success) { setError("Вкажіть безпечне посилання."); return; } editor?.chain().focus().extendMarkRange("link").setLink({ href: link }).run(); }}>Додати посилання</button>
        <button type="button" disabled={pending || !editor} className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}>Видалити посилання</button>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className={`${label} min-w-52 flex-1`}>Альтернативний текст зображення<input className={input} disabled={pending} value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} /></label>
        <label className={label}>Додати зображення<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} className={input} onChange={(e) => { upload(e.target.files?.[0], "content"); e.target.value = ""; }} /></label>
      </div>
      <div className="overflow-x-auto rounded border [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:pl-4 [&_.tiptap_h2]:mt-5 [&_.tiptap_h2]:text-2xl [&_.tiptap_h2]:font-bold [&_.tiptap_h3]:mt-4 [&_.tiptap_h3]:text-xl [&_.tiptap_h3]:font-bold [&_.tiptap_h4]:mt-3 [&_.tiptap_h4]:text-lg [&_.tiptap_h4]:font-bold [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-6 [&_.tiptap_p]:my-2 [&_.tiptap_table]:w-full [&_.tiptap_td]:border [&_.tiptap_td]:p-2 [&_.tiptap_th]:border [&_.tiptap_th]:p-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6"><EditorContent editor={editor} /></div>
      <p className="mt-2 text-sm text-slate-600">Для перегляду збережіть чернетку. Зображення завантажуються до медіатеки. Юридичні тексти перевіряє власник магазину.</p>
    </section>
  </div>;
}

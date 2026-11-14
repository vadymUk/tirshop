import type { ReactNode } from "react";
import { mediaUrl } from "@/lib/admin/media-shared";
import { parseRichContent, type PageDocument, type RichNode } from "@/lib/pages/schema";

function renderNode(node: RichNode, key: number): ReactNode {
  const children = node.content?.map(renderNode);
  switch (node.type) {
    case "doc": return <div key={key} className="space-y-4">{children}</div>;
    case "paragraph": return <p key={key} className="whitespace-pre-wrap">{children}</p>;
    case "heading": {
      const level = Number(node.attrs?.level);
      if (level === 2) return <h2 key={key} className="mt-8 text-2xl font-bold">{children}</h2>;
      if (level === 3) return <h3 key={key} className="mt-6 text-xl font-bold">{children}</h3>;
      return <h4 key={key} className="mt-4 text-lg font-bold">{children}</h4>;
    }
    case "text": {
      let text: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        if (mark.type === "italic") text = <em>{text}</em>;
        if (mark.type === "link") text = <a className="text-blue-700 underline" href={String(mark.attrs?.href)}>{text}</a>;
      }
      return <span key={key}>{text}</span>;
    }
    case "hardBreak": return <br key={key} />;
    case "bulletList": return <ul key={key} className="list-disc space-y-1 pl-6">{children}</ul>;
    case "orderedList": return <ol key={key} className="list-decimal space-y-1 pl-6" start={Number(node.attrs?.start) || 1}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key} className="border-l-4 border-slate-400 pl-4">{children}</blockquote>;
    case "image": return <img key={key} src={String(node.attrs?.src)} alt={String(node.attrs?.alt ?? "")} className="h-auto max-w-full" />;
    case "table": return <div key={key} className="max-w-full overflow-x-auto"><table className="w-full border-collapse text-left"><tbody>{children}</tbody></table></div>;
    case "tableRow": return <tr key={key}>{children}</tr>;
    case "tableHeader": return <th key={key} scope="col" className="border p-2">{children}</th>;
    case "tableCell": return <td key={key} className="border p-2">{children}</td>;
    default: throw new Error("Непідтримуваний елемент документа.");
  }
}

export function PageContent({ document }: { document: PageDocument }) {
  const content = parseRichContent(document.content);
  return <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
    <h1 className="mb-4 text-3xl font-bold sm:text-4xl">{document.title}</h1>
    {document.excerpt && <p className="mb-6 text-lg text-slate-600">{document.excerpt}</p>}
    {document.featured_image_path && <img src={mediaUrl("site-media", document.featured_image_path)} alt="" className="mb-6 h-auto max-w-full" />}
    {renderNode(content, 0)}
  </article>;
}

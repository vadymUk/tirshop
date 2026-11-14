import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageContent } from "@/components/pages/page-content";
import { emptyPage, pageDocumentSchema, pageHref, parseRichContent } from "@/lib/pages/schema";

const text = (value: string) => ({ type: "text", text: value });
const document = pageDocumentSchema.parse({
  ...emptyPage, slug: "privacy", title: "Політика",
  content: { type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [text("Права")] },
    { type: "paragraph", content: [text("<script>alert(1)</script>"), { ...text("посилання"), marks: [{ type: "link", attrs: { href: "/contact" } }] }] },
    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Пункт")] }] }] },
    { type: "table", content: [{ type: "tableRow", content: [
      { type: "tableHeader", content: [{ type: "paragraph", content: [text("Назва")] }] },
      { type: "tableCell", content: [{ type: "paragraph", content: [text("Значення")] }] },
    ] }] },
  ] },
});

describe("page structured content", () => {
  it("renders escaped text with semantic headings, lists, links and tables", () => {
    const html = renderToStaticMarkup(<PageContent document={document} />);
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("<ul");
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('href="/contact"');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("rejects unsafe URLs, unsupported nodes, malformed dates and excessive documents", () => {
    for (const href of ["javascript:alert(1)", "//evil.test", "/\\evil.test", "http://evil.test"]) {
      expect(() => parseRichContent({ type: "doc", content: [{ type: "paragraph", content: [{ ...text("x"), marks: [{ type: "link", attrs: { href } }] }] }] })).toThrow();
    }
    expect(() => parseRichContent({ type: "doc", content: [{ type: "image", attrs: { src: "https://evil.test/x.png" } }] })).toThrow();
    expect(() => parseRichContent({ type: "doc", content: [{ type: "script" }] })).toThrow();
    expect(() => parseRichContent({ type: "doc", content: [{ type: "paragraph", content: [text("x".repeat(100001))] }] })).toThrow();
    expect(pageDocumentSchema.safeParse({ ...document, published_at: "2025-02-30T00:00:00Z" }).success).toBe(false);
    expect(pageDocumentSchema.safeParse({ ...document, canonical_url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("routes reserved and custom slugs without overlap", () => {
    expect(pageHref("privacy")).toBe("/privacy");
    expect(pageHref("news")).toBe("/pages/news");
  });
});

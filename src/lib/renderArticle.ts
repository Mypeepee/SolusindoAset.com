// Renders markdown → HTML and extracts a heading-based table of contents.
// Heading ids are injected so the TOC can deep-link / scroll-spy.
import markdownToHtml from "@/utils/markdownToHtml";
import { slugify } from "@/lib/berita";

export type TocItem = { id: string; text: string; level: 2 | 3 };

export async function renderArticle(
  markdown: string
): Promise<{ html: string; toc: TocItem[] }> {
  const raw = await markdownToHtml(markdown || "");
  const toc: TocItem[] = [];
  const used = new Set<string>();

  const html = raw.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const base = slugify(text) || `bagian-${toc.length + 1}`;
    let id = base;
    let n = 1;
    while (used.has(id)) {
      n += 1;
      id = `${base}-${n}`;
    }
    used.add(id);
    toc.push({ id, text, level: (Number(lvl) === 3 ? 3 : 2) as 2 | 3 });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });

  return { html, toc };
}

import { toHast } from "mdast-util-to-hast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

type Node = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

const parser = unified().use(remarkParse).use(remarkGfm);
const TAGS = new Set(
  "p h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code em strong del a br hr table thead tbody tr th td".split(
    " ",
  ),
);
const VOID = new Set(["br", "hr"]);
const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function html(node: Node): string {
  // Raw HTML in the source is shown as text, never parsed.
  if (node.type === "text" || node.type === "raw") return esc(node.value ?? "");
  if (node.type !== "element" && node.type !== "root") return "";
  const inner = (node.children ?? []).map(html).join("");
  if (node.type === "root" || !TAGS.has(node.tagName ?? "")) return inner;
  const href = node.tagName === "a" ? String(node.properties?.href ?? "") : "";
  const attrs = /^(https?:|mailto:)/i.test(href)
    ? ` href="${esc(href)}" rel="noopener noreferrer"`
    : "";
  const tag = node.tagName ?? "";
  return VOID.has(tag) ? `<${tag}>` : `<${tag}${attrs}>${inner}</${tag}>`;
}

/**
 * Markdown to static HTML. Only a short allowlist of tags is written, raw HTML in the source is
 * shown as text, images are omitted and a link keeps its href only for http(s) and mailto.
 */
export function markdownToSafeHtml(markdown: string): string {
  return html(toHast(parser.parse(markdown), { allowDangerousHtml: true }) as Node);
}

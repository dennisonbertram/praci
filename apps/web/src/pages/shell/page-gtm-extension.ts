import type { GtmPageBlock } from "@rakazo/contracts";
import { pageGtmFence, parsePageGtm } from "@rakazo/core";
import { Node } from "@tiptap/react";

const FENCE = /^```(gtm-[a-z-]+)[ \t]*\n([\s\S]*?)\n`{3,}[ \t]*(?:\n|$)/;

function readBlock(raw: string): GtmPageBlock | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown; query?: unknown };
    if (!value || typeof value.type !== "string") return null;
    const result = parsePageGtm(value.type, JSON.stringify(value.query));
    return "block" in result ? result.block : null;
  } catch {
    return null;
  }
}

export const PageGtmNode = Node.create({
  name: "pageGtm",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      block: {
        default: null,
        parseHTML: (element) => readBlock(element.getAttribute("data-page-gtm") ?? ""),
        renderHTML: (attributes) => ({ "data-page-gtm": JSON.stringify(attributes.block) }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-page-gtm]",
        getAttrs: (element) =>
          readBlock(element.getAttribute("data-page-gtm") ?? "") ? null : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes];
  },
  markdownTokenizer: {
    name: "pageGtm",
    level: "block",
    start: (src: string) => src.indexOf("```gtm-"),
    tokenize: (src: string, _tokens: unknown, lexer: unknown) => {
      if ((lexer as { state?: { top?: boolean } }).state?.top === false) return undefined;
      const match = FENCE.exec(src);
      return match
        ? { type: "pageGtm", raw: match[0], fence: match[1], text: match[2] ?? "" }
        : undefined;
    },
  },
  parseMarkdown: (token) => {
    const fence = String(token.fence ?? "");
    const raw = String(token.text ?? "");
    const result = parsePageGtm(fence, raw);
    return "block" in result
      ? { type: "pageGtm", attrs: { block: result.block } }
      : {
          type: "codeBlock",
          attrs: { language: fence },
          content: raw ? [{ type: "text", text: raw }] : [],
        };
  },
  renderMarkdown: (node) => pageGtmFence(node.attrs?.block as GtmPageBlock),
});

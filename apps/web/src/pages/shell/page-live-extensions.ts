import type { PageMetricBlock, PageTableBlock } from "@rakazo/contracts";
import {
  PAGE_METRIC_FENCE,
  PAGE_TABLE_FENCE,
  PageMetricBlockSchema,
  PageTableBlockSchema,
} from "@rakazo/contracts";
import { pageMetricFence, pageTableFence } from "@rakazo/core";
import { Node } from "@tiptap/react";

/** Structural, so web and contracts need not share one zod build. */
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

function readBlock<T>(schema: Schema<T>, raw: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * A ```metric or ```table fence as an atom block, like a chart: delete-only, and a fence that
 * does not parse stays a plain code block so nothing is lost.
 */
function liveFenceNode<T extends PageMetricBlock | PageTableBlock>(
  name: string,
  fence: string,
  schema: Schema<T>,
  serialize: (block: T) => string,
) {
  const attribute = `data-page-${fence}`;
  const open = new RegExp(`^\`\`\`${fence}[ \\t]*\\n([\\s\\S]*?)\\n\`\`\`[ \\t]*(?:\\n|$)`);
  return Node.create({
    name,
    group: "block",
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        block: {
          default: null,
          parseHTML: (element) => readBlock(schema, element.getAttribute(attribute) ?? ""),
          renderHTML: (attributes) => ({ [attribute]: JSON.stringify(attributes.block) }),
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: `div[${attribute}]`,
          getAttrs: (element) =>
            readBlock(schema, element.getAttribute(attribute) ?? "") ? null : false,
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", HTMLAttributes];
    },
    markdownTokenizer: {
      name,
      level: "block",
      start: (src: string) => src.indexOf(`\`\`\`${fence}`),
      tokenize: (src: string, _tokens: unknown, lexer: unknown) => {
        if ((lexer as { state?: { top?: boolean } }).state?.top === false) return undefined;
        const match = open.exec(src);
        return match ? { type: name, raw: match[0], text: match[1] ?? "" } : undefined;
      },
    },
    parseMarkdown: (token) => {
      const raw = String(token.text ?? "");
      const block = readBlock(schema, raw);
      if (block) return { type: name, attrs: { block } };
      return {
        type: "codeBlock",
        attrs: { language: fence },
        content: raw ? [{ type: "text", text: raw }] : [],
      };
    },
    renderMarkdown: (node) => serialize(node.attrs?.block as T),
  });
}

export const PageMetricNode = liveFenceNode(
  "pageMetric",
  PAGE_METRIC_FENCE,
  PageMetricBlockSchema,
  pageMetricFence,
);
export const PageTableNode = liveFenceNode(
  "pageTable",
  PAGE_TABLE_FENCE,
  PageTableBlockSchema,
  pageTableFence,
);

import { firewallPageTextIsFree } from "@rakazo/core";
import type { Token } from "marked";
import { lexer } from "marked";

/**
 * Every link and image destination and every raw HTML block in a page, as the page view's Markdown
 * parser (marked, under Tiptap) reads it. Parsing settles what text alone cannot: whether a line is
 * code or live (fences, indentation, lazy continuation) and which reference a `![r]` resolves to.
 */
function pageDestinations(markdown: string): string[] {
  const found: string[] = [];
  const walk = (tokens: Token[] | undefined) => {
    for (const token of tokens ?? []) {
      if (token.type === "link" || token.type === "image") {
        if (token.type === "link" && token.href === `mailto:${token.text}`) {
          // Marked parses a bare email as a GFM autolink; it is plain text in this context.
        } else found.push(`${token.type} ${token.href}`);
      } else if (token.type === "html") {
        found.push(`html ${token.raw}`);
      }
      const nested = token as Token & {
        tokens?: Token[];
        items?: Token[];
        header?: { tokens: Token[] }[];
        rows?: { tokens: Token[] }[][];
      };
      walk(nested.tokens);
      walk(nested.items);
      for (const cell of nested.header ?? []) walk(cell.tokens);
      for (const row of nested.rows ?? []) for (const cell of row) walk(cell.tokens);
    }
  };
  walk(lexer(markdown));
  return found;
}

/**
 * A Firewall agent's page write is free only when it adds no outbound address: neither the parsed
 * destinations nor the text check (`firewallPageTextIsFree`) may find anything that was not on the
 * page before. Any parse failure asks.
 */
export function firewallPageWriteAddsNothing(before: string, after: string): boolean {
  if (!firewallPageTextIsFree(before, after)) return false;
  try {
    const available = new Map<string, number>();
    for (const item of pageDestinations(before)) {
      available.set(item, (available.get(item) ?? 0) + 1);
    }
    for (const item of pageDestinations(after)) {
      const left = available.get(item) ?? 0;
      if (left === 0) return false;
      available.set(item, left - 1);
    }
    return true;
  } catch {
    return false;
  }
}

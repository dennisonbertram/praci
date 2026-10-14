import type { Editor } from "@tiptap/react";

/**
 * Where the caret goes when a reply or forward opens again: the end of the person's own text
 * above the quote, or the top of the body when they wrote none. A reply's attribution line
 * ("On Mon, Sam wrote:") sits just above its quote and is not theirs.
 * Returns null when the body has no quote.
 */
export function caretAboveQuote(editor: Editor, hasAttribution: boolean): number | null {
  const { doc } = editor.state;
  let quoteIndex = -1;
  const tops: number[] = [];
  doc.forEach((node, offset, index) => {
    if (quoteIndex < 0 && node.type.name === "blockquote") quoteIndex = index;
    tops.push(offset);
  });
  if (quoteIndex < 0) return null;
  const limit = tops[hasAttribution ? Math.max(0, quoteIndex - 1) : quoteIndex] ?? 0;
  let end = 1;
  doc.descendants((node, pos) => {
    if (pos >= limit) return false;
    if (node.isTextblock && node.textContent.trim() !== "") end = pos + node.nodeSize - 1;
    return true;
  });
  return end;
}

/** Puts the caret in a restored composer's body without scrolling the dialog. */
export function focusRestored(editor: Editor, hasAttribution: boolean) {
  const at = caretAboveQuote(editor, hasAttribution);
  editor.commands.focus(at ?? "end", { scrollIntoView: false });
}

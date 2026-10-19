/** One Data room file a message carries by reference. */
export type DataRoomReference = { id: string; name: string };

const LINE = /^Data room item (\S+): (.+)$/;

/** The line the server appends to a message for one Data room file. */
export const dataRoomReferenceLine = ({ id, name }: DataRoomReference) =>
  `Data room item ${id}: ${name.replace(/\s+/g, " ")}`;

/**
 * Separates the lines the server appends for Data room files from what the person wrote, so they
 * can be shown as file chips instead of raw ids. Only a block of such lines at the very end,
 * set off from the text by a blank line (or alone), counts.
 */
export function splitDataRoomReferences(text: string): {
  body: string;
  refs: DataRoomReference[];
} {
  const lines = text.split("\n");
  const refs: DataRoomReference[] = [];
  let end = lines.length;
  while (end > 0) {
    const match = LINE.exec((lines[end - 1] ?? "").trimEnd());
    if (!match) break;
    refs.unshift({ id: match[1]!, name: match[2]! });
    end -= 1;
  }
  if (!refs.length || (end > 0 && (lines[end - 1] ?? "").trim() !== "")) {
    return { body: text, refs: [] };
  }
  return { body: lines.slice(0, end).join("\n").trim(), refs };
}

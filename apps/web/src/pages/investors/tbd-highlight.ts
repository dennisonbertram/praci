import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/react";

/** A placeholder left in a draft where a fact was not known. */
export const TBD = /\bTBD\b/g;

/** Counts the placeholders in markdown. */
export const countTbd = (markdown: string) => markdown.match(TBD)?.length ?? 0;

/** Marks every TBD in the text with a highlight, without changing the document. */
export const TbdHighlight = Extension.create({
  name: "tbdHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const found: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              for (const match of node.text.matchAll(TBD))
                found.push(
                  Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
                    class: "rounded-sm bg-warning/20",
                    "data-tbd": "",
                  }),
                );
            });
            return DecorationSet.create(state.doc, found);
          },
        },
      }),
    ];
  },
});

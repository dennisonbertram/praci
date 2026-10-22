// @vitest-environment jsdom

import { Editor } from "@tiptap/react";
import { expect, it } from "vitest";
import { isNewerRemote, resolveRemotePage } from "../../lib/page-sync";
import { PAGE_EXTENSIONS } from "./page-extensions";

function roundTrip(content: string) {
  const editor = new Editor({
    extensions: PAGE_EXTENSIONS,
    content,
    contentType: "markdown",
  });
  const out = editor.getMarkdown();
  editor.destroy();
  return out;
}

const chart = {
  name: "Burn",
  spec: { marks: [{ type: "line", x: "m", y: "v" }] },
  data: [{ m: 1, v: 2 }],
};
const fence = `\`\`\`chart\n${JSON.stringify(chart)}\n\`\`\``;

it("round-trips atomic GTM blocks without exposing editable query text", () => {
  const content =
    '# Focus\n\n```gtm-plan\n{"group":"drafts","channel":["x"],"limit":3}\n```\n\n```gtm-metric\n{"label":"Completed","count":"done","goal":50}\n```';
  const editor = new Editor({ extensions: PAGE_EXTENSIONS, content, contentType: "markdown" });
  expect(editor.getJSON().content?.filter((node) => node.type === "pageGtm")).toHaveLength(2);
  expect(editor.schema.nodes.pageGtm?.isAtom).toBe(true);
  expect(editor.schema.nodes.pageGtm?.spec.draggable).toBe(true);
  expect(editor.getMarkdown()).toBe(content);
  editor.destroy();
});

it("keeps headings, lists and chart fences through load and save", () => {
  const page = `# Weekly\n\nIntro text.\n\n- one\n- two\n\n${fence}\n\nAfter.`;
  expect(roundTrip(page)).toBe(page);
});

it("keeps a chart fence that does not parse", () => {
  const page = "```chart\n{not json\n```";
  expect(roundTrip(page)).toBe(page);
});

it("reloads a remote update only when nothing is unsaved", () => {
  expect(resolveRemotePage({ dirty: false })).toBe("reload");
  expect(resolveRemotePage({ dirty: true })).toBe("offer");
});

it.each([
  ["table", "| a   | b   |\n| --- | --- |\n| 1   | 2   |"],
  ["task list", "- [ ] todo\n- [x] done"],
  ["blockquote", "> quoted\n> more"],
  ["code block", "```ts\nconst a = 1;\n```"],
  ["link", "See [docs](https://example.com/a)."],
  ["image", "![alt](https://example.com/a.png)"],
  ["rule", "one\n\n---\n\ntwo"],
  ["nested list", "- a\n  - b\n    - c\n- d"],
])("keeps a %s", (_name, page) => {
  expect(roundTrip(page).trim()).toBe(page);
});

it("keeps a chart fence inside a quote as a quote", () => {
  const page = `> ${"```chart"}\n> {"x":1}\n> ${"```"}`;
  const editor = new Editor({
    extensions: PAGE_EXTENSIONS,
    content: page,
    contentType: "markdown",
  });
  expect(JSON.stringify(editor.getJSON())).not.toContain("pageChart");
  editor.destroy();
});

it("drops a pasted chart that does not parse and keeps one that does", () => {
  const editor = new Editor({ extensions: PAGE_EXTENSIONS, content: "x", contentType: "markdown" });
  editor.commands.setContent(`<div data-page-chart="nope"></div><p>y</p>`, { contentType: "html" });
  expect(JSON.stringify(editor.getJSON())).not.toContain("pageChart");
  editor.commands.setContent(`<div data-page-chart='${JSON.stringify(chart)}'></div>`, {
    contentType: "html",
  });
  expect(editor.getMarkdown().trim()).toBe(fence);
  editor.destroy();
});

it("ignores remote revisions before the first load and at or below the loaded one", () => {
  expect(isNewerRemote({ loadedRevision: 0, remoteRevision: 1 })).toBe(false);
  expect(isNewerRemote({ loadedRevision: 1, remoteRevision: 1 })).toBe(false);
  expect(isNewerRemote({ loadedRevision: 1, remoteRevision: 2 })).toBe(true);
});

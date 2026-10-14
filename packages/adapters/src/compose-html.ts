import { JSDOM } from "jsdom";

/** Only what the compose editor produces. Anything else is unwrapped (its text stays) or dropped. */
const KEEP = new Set([
  "p",
  "br",
  "div",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
]);
const DROP = new Set(["script", "style", "head", "title", "template", "iframe", "object", "embed"]);
const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s"<>]+$/i;

function clean(node: Node, doc: Document): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 8) {
      child.parentNode?.removeChild(child);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) {
      el.remove();
      continue;
    }
    clean(el, doc);
    if (!KEEP.has(tag)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    const href = tag === "a" ? (el.getAttribute("href") ?? "").trim() : "";
    for (const name of el.getAttributeNames()) el.removeAttribute(name);
    if (tag === "a") {
      if (SAFE_HREF.test(href)) el.setAttribute("href", href);
      else el.replaceWith(...el.childNodes);
    }
  }
}

/** The editor's HTML reduced to the allowed tags; links keep only http, https and mailto hrefs. */
export function sanitizeComposeHtml(html: string): string {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  clean(document.body, document);
  return document.body.innerHTML;
}

const BLOCK = new Set(["p", "div", "ul", "ol", "li", "blockquote"]);

function textOf(node: Node): string {
  let out = "";
  let ordinal = 0;
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      out += (child.textContent ?? "").replace(/\s+/g, " ");
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") out += "\n";
    else if (tag === "li") {
      ordinal += 1;
      const marker = node.nodeName.toLowerCase() === "ol" ? `${ordinal}. ` : "- ";
      out += `${marker}${textOf(el).trim()}\n`;
    } else if (tag === "blockquote") {
      const lines = textOf(el).trim().split("\n");
      out += `\n${lines.map((line) => (line ? `> ${line}` : ">")).join("\n")}\n`;
    } else if (tag === "a") {
      const label = textOf(el);
      const href = el.getAttribute("href") ?? "";
      out +=
        href && label.trim() !== href && label.trim() !== href.replace(/^mailto:/i, "")
          ? `${label} (${href})`
          : label;
    } else out += BLOCK.has(tag) ? `\n${textOf(el)}\n` : textOf(el);
  }
  return out;
}

/** Plain text for the text/plain part: one line break per block, lists and quotes marked. */
export function htmlToText(html: string): string {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  return textOf(document.body)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

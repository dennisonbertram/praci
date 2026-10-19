import { useEffect, useRef, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";

const PREVIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'";

// frame-src about: allows srcdoc and rejects navigations the sandbox and inner CSP do not block.
const SHELL_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src about:; child-src 'none'; form-action 'none'; base-uri 'none'";

const PREVIEW_GUARD = `<script>
document.addEventListener("click", (event) => {
  const target = event.target;
  const link = target instanceof Element ? target.closest("a[href]") : null;
  if (!link) return;
  const href = link.getAttribute("href") ?? "";
  event.preventDefault();
  if (href.startsWith("#")) location.hash = href;
}, true);
document.addEventListener("submit", (event) => event.preventDefault(), true);
</script>`;

/** JSON-embed so user HTML cannot close the shell's script and run in it. */
function embedScriptString(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * The one script an email frame may run: it reports the message's height so the frame can fit it.
 * It is pinned by hash, so no script or inline handler from the email itself can run, and the frame
 * has no allow-same-origin, so even this script cannot reach the app. Change the text and the hash
 * together (a test checks they match).
 */
export const EMAIL_HEIGHT_SCRIPT = `(()=>{let last=0;const send=()=>{const h=Math.ceil(document.documentElement.getBoundingClientRect().height);if(h!==last){last=h;parent.postMessage({type:"rakazo-email-height",height:h},"*")}};new ResizeObserver(send).observe(document.documentElement);addEventListener("load",send);send()})();`;
export const EMAIL_HEIGHT_SCRIPT_HASH = "sha256-6RpnQvW9DYV8jCtQSnZW5rlzGspOpUNiizQnBvHvo0I=";
const EMAIL_HEIGHT_MESSAGE = "rakazo-email-height";
// ponytail: a cap so a hostile height cannot make a page millions of pixels tall; longer mail scrolls inside.
const MAX_EMAIL_HEIGHT = 20_000;

// Without scripts, links go nowhere: the shell's frame-src rejects the navigation.
const previewCsp = (scripts: boolean, email: boolean) => {
  if (email)
    return PREVIEW_CSP.replace(
      "script-src 'unsafe-inline'",
      `script-src '${EMAIL_HEIGHT_SCRIPT_HASH}'`,
    ).replace("img-src data:", `img-src data: ${proxyOrigin()}`);
  return scripts
    ? PREVIEW_CSP
    : PREVIEW_CSP.replace("script-src 'unsafe-inline'", "script-src 'none'");
};

// Remote images reach an email only through the server's image proxy, so the sender never sees the reader's
// address. The frame may load images from the app's own origin, never from the open web.
const IMAGE_PROXY_PREFIX = "/api/inbox/image?";
const proxyOrigin = () => window.location.origin;

// A srcdoc frame inherits the shell's policy too, so email mode lifts the image block here as well.
const shellCsp = (email: boolean) =>
  email ? `${SHELL_CSP}; img-src data: ${proxyOrigin()}` : SHELL_CSP;

// New-tab navigations are not covered by the shell's frame-src; the popup is not sandboxed.
const POPUP_FLAGS = "allow-popups allow-popups-to-escape-sandbox";

/**
 * Makes http(s) links open in a new tab with no opener or referrer, and removes every other link
 * target (javascript:, data:, in-page anchors). Done here, on an inert parsed copy, because the
 * message frame has no script to do it and the shell cannot reach into it.
 */
function openLinksInNewTab(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // The CSP already blocks these; removing them as well keeps the pinned height script the only one.
  for (const script of doc.querySelectorAll("script")) script.remove();
  for (const el of doc.querySelectorAll("*"))
    for (const attr of [...el.attributes])
      if (attr.name.toLowerCase().startsWith("on")) el.removeAttribute(attr.name);
  for (const link of doc.querySelectorAll("a[href], area[href]")) {
    if (/^https?:/i.test((link.getAttribute("href") ?? "").trim())) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    } else link.removeAttribute("href");
  }
  maskAmounts(doc);
  collapseQuotes(doc);
  tidyImages(doc);
  return doc.documentElement.outerHTML;
}

/**
 * The server has already pointed remote images at its proxy. Those get an absolute address, since the frame has no
 * base URL. Any other image the frame cannot load (a direct http(s) link, a cid: that was not embedded, an empty
 * src) and tracking pixels would show as a broken icon or an empty box, so they are removed; real alt text stays
 * as muted text.
 */
function tidyImages(doc: Document): void {
  for (const img of doc.querySelectorAll("img")) {
    const src = (img.getAttribute("src") ?? "").trim();
    const tiny = [img.getAttribute("width"), img.getAttribute("height")].some(
      (v) => v !== null && Number.parseInt(v, 10) <= 2,
    );
    img.removeAttribute("srcset");
    if (!tiny && src.startsWith(IMAGE_PROXY_PREFIX)) {
      img.setAttribute("src", proxyOrigin() + src);
      continue;
    }
    if (!tiny && /^data:/i.test(src)) continue;
    const alt = (img.getAttribute("alt") ?? "").trim();
    if (!tiny && /[\p{L}\p{N}]{2,}/u.test(alt)) {
      const note = doc.createElement("span");
      note.setAttribute("style", "color:#777");
      note.textContent = alt;
      img.replaceWith(note);
    } else img.remove();
  }
}

/** Folds quoted replies behind a native "…" toggle, as Gmail does. <details> needs no script. */
function collapseQuotes(doc: Document): void {
  for (const quote of doc.querySelectorAll(".gmail_quote, blockquote[type=cite]")) {
    if (quote.parentElement?.closest(".gmail_quote, blockquote[type=cite]")) continue;
    const details = doc.createElement("details");
    const summary = doc.createElement("summary");
    summary.textContent = "\u2026";
    details.append(summary);
    quote.replaceWith(details);
    details.append(quote);
  }
}

/** While amounts are hidden, masks currency in the visible text and in title/alt attributes. */
function maskAmounts(doc: Document): void {
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("style, script")) continue;
    node.textContent = maskCurrencyWhenHidden(node.textContent ?? "");
  }
  for (const el of doc.querySelectorAll("[title], [alt]"))
    for (const name of ["title", "alt"]) {
      const value = el.getAttribute(name);
      if (value) el.setAttribute(name, maskCurrencyWhenHidden(value));
    }
}

// Email is designed for white paper, so it is shown on white in both themes and never recoloured. The base style
// only sets defaults the message can override; media and tables are capped at the frame width, long words wrap,
// and a fixed-width table scrolls sideways (never clips). The frame is as tall as its content, so the page scrolls.
const EMAIL_FIT = `<meta name="viewport" content="width=device-width,initial-scale=1"><style>html{overflow-x:auto}html,body{margin:0;background:#fff;color:#1f1f1f}body{padding:20px 24px;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}@media(max-width:480px){body{padding:12px}}img,video,table{max-width:100%!important;height:auto}img{color:#777;font-size:13px}details>summary{cursor:pointer;display:inline-block;padding:0 6px;border-radius:4px;background:#eee;color:#555;line-height:1.2}</style>`;

function withPreviewDocument(html: string, scripts: boolean, email: boolean): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${previewCsp(scripts, email)}">`;
  const referrer = `<meta name="referrer" content="no-referrer">`;
  const body = email
    ? `${EMAIL_FIT}<script>${EMAIL_HEIGHT_SCRIPT}</script>${openLinksInNewTab(html)}`
    : html;
  return `${meta}${referrer}${scripts ? PREVIEW_GUARD : ""}${body}`;
}

// The shell passes on height reports only from its own message frame, and only in the expected shape.
const SHELL_HEIGHT_RELAY = `const preview=document.getElementById("preview");addEventListener("message",(e)=>{const d=e.data;if(e.source!==preview.contentWindow||!d||d.type!=="${EMAIL_HEIGHT_MESSAGE}"||typeof d.height!=="number")return;parent.postMessage({type:"${EMAIL_HEIGHT_MESSAGE}",height:d.height},"*")});`;

function shellDocument(innerHtml: string, scripts: boolean, email: boolean): string {
  const payload = embedScriptString(innerHtml);
  const sandbox = email ? `allow-scripts ${POPUP_FLAGS}` : scripts ? "allow-scripts" : "";
  return `<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="${shellCsp(email)}"><meta name="referrer" content="no-referrer"><style>html,body{height:100%;margin:0}iframe{width:100%;height:100%;border:0;background:#fff}</style><iframe id="preview" sandbox="${sandbox}" referrerpolicy="no-referrer" csp="${previewCsp(scripts, email)}"></iframe><script>${email ? SHELL_HEIGHT_RELAY : ""}document.getElementById("preview").srcdoc=${payload};</script>`;
}

/**
 * `scripts={false}` is for untrusted content such as email: the preview runs no script at all.
 * `email` shows a whole message: https images load and links open in a new tab, still with no
 * script. It implies `scripts={false}`.
 */
export function SandboxedHtmlViewer({
  html,
  title,
  scripts = true,
  email = false,
}: {
  html: string;
  title: string;
  scripts?: boolean;
  email?: boolean;
}) {
  const runScripts = scripts && !email;
  useHideAmounts(); // re-render, and so re-mask, when the switch flips
  const frame = useRef<HTMLIFrameElement>(null);
  // Key presses inside the sandboxed frame never reach this page, so Escape and j/k stop working
  // after a click in it (such as on a link, which opens in a new tab). When the person comes back,
  // focus moves from the frame to the dialog around it.
  useEffect(() => {
    if (!email) return;
    const onFocus = () => {
      if (document.activeElement === frame.current)
        frame.current?.closest<HTMLElement>('[role="dialog"]')?.focus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [email]);
  // An email frame is as tall as its message, so the dialog scrolls instead of the frame.
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!email) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; height?: unknown } | null;
      if (event.source !== frame.current?.contentWindow || data?.type !== EMAIL_HEIGHT_MESSAGE)
        return;
      if (typeof data.height !== "number" || !Number.isFinite(data.height) || data.height <= 0)
        return;
      setHeight(Math.min(Math.ceil(data.height), MAX_EMAIL_HEIGHT));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [email]);
  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={shellDocument(withPreviewDocument(html, runScripts, email), runScripts, email)}
      sandbox={email ? `allow-scripts ${POPUP_FLAGS}` : "allow-scripts"}
      referrerPolicy="no-referrer"
      style={email && height ? { height } : undefined}
      className={
        email ? "block min-h-32 w-full border-0 bg-white" : "h-full w-full border-0 bg-white"
      }
    />
  );
}

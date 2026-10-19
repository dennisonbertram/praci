import { useEffect, useRef } from "react";
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

// Without scripts, links go nowhere: the shell's frame-src rejects the navigation.
const previewCsp = (scripts: boolean, email: boolean) => {
  const csp = scripts
    ? PREVIEW_CSP
    : PREVIEW_CSP.replace("script-src 'unsafe-inline'", "script-src 'none'");
  return email ? csp.replace("img-src data:", `img-src data: ${proxyOrigin()}`) : csp;
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
  return `${meta}${referrer}${scripts ? PREVIEW_GUARD : ""}${email ? EMAIL_FIT + openLinksInNewTab(html) : html}`;
}

function shellDocument(innerHtml: string, scripts: boolean, email: boolean): string {
  const payload = embedScriptString(innerHtml);
  const sandbox = email ? POPUP_FLAGS : scripts ? "allow-scripts" : "";
  return `<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="${shellCsp(email)}"><meta name="referrer" content="no-referrer"><style>html,body{height:100%;margin:0}iframe{width:100%;height:100%;border:0;background:#fff}</style><iframe id="preview" sandbox="${sandbox}" referrerpolicy="no-referrer" csp="${previewCsp(scripts, email)}"></iframe><script>document.getElementById("preview").srcdoc=${payload};</script>`;
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
  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={shellDocument(withPreviewDocument(html, runScripts, email), runScripts, email)}
      sandbox={email ? `allow-scripts ${POPUP_FLAGS}` : "allow-scripts"}
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-white"
    />
  );
}

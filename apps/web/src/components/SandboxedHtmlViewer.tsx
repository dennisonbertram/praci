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
  return email ? csp.replace("img-src data:", "img-src data: https:") : csp;
};

// A srcdoc frame inherits the shell's policy too, so email mode lifts the image block here as well.
const shellCsp = (email: boolean) => (email ? `${SHELL_CSP}; img-src data: https:` : SHELL_CSP);

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
  return doc.documentElement.outerHTML;
}

// Email is laid out for a narrow frame: shrink media and tables, wrap long words, and scroll
// sideways (never clip) when a fixed-width table is still wider than the frame.
const EMAIL_FIT = `<meta name="viewport" content="width=device-width,initial-scale=1"><style>img,video,table{max-width:100%!important;height:auto}table{width:auto!important}body{overflow-x:auto;overflow-wrap:anywhere}</style>`;

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
  return (
    <iframe
      title={title}
      srcDoc={shellDocument(withPreviewDocument(html, runScripts, email), runScripts, email)}
      sandbox={email ? `allow-scripts ${POPUP_FLAGS}` : "allow-scripts"}
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-white"
    />
  );
}

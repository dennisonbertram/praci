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
const previewCsp = (scripts: boolean) =>
  scripts ? PREVIEW_CSP : PREVIEW_CSP.replace("script-src 'unsafe-inline'", "script-src 'none'");

function withPreviewDocument(html: string, scripts: boolean): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${previewCsp(scripts)}">`;
  const referrer = `<meta name="referrer" content="no-referrer">`;
  return `${meta}${referrer}${scripts ? PREVIEW_GUARD : ""}${html}`;
}

function shellDocument(innerHtml: string, scripts: boolean): string {
  const payload = embedScriptString(innerHtml);
  return `<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="${SHELL_CSP}"><meta name="referrer" content="no-referrer"><style>html,body{height:100%;margin:0}iframe{width:100%;height:100%;border:0;background:#fff}</style><iframe id="preview" sandbox="${scripts ? "allow-scripts" : ""}" referrerpolicy="no-referrer" csp="${previewCsp(scripts)}"></iframe><script>document.getElementById("preview").srcdoc=${payload};</script>`;
}

/** `scripts={false}` is for untrusted content such as email: the preview runs no script at all. */
export function SandboxedHtmlViewer({
  html,
  title,
  scripts = true,
}: {
  html: string;
  title: string;
  scripts?: boolean;
}) {
  return (
    <iframe
      title={title}
      srcDoc={shellDocument(withPreviewDocument(html, scripts), scripts)}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-white"
    />
  );
}

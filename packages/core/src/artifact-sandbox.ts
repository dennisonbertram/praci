// Same policy as the web preview: nothing loads from the network, so a script
// cannot send what it reads to a remote image or font URL.
export const SANDBOXED_ARTIFACT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'";

// Email shows a whole message: https images load (as on web) but no script can run at all.
export const SANDBOXED_EMAIL_CSP = SANDBOXED_ARTIFACT_CSP.replace(
  "script-src 'unsafe-inline'",
  "script-src 'none'",
).replace("img-src data:", "img-src data: https:");

const PLAIN_HTML_DOCTYPE = /^\s*<!doctype\s+html\s*>/i;

/**
 * Wraps bot-authored HTML with a restrictive CSP before it's handed to a
 * sandboxed viewer (a web iframe's `srcdoc`, or a native WebView's `source.html`).
 * The CSP alone isn't the isolation boundary — on web that's the iframe's
 * `sandbox="allow-scripts"` (no `allow-same-origin`); on native it's the
 * WebView never sharing the app's cookies/storage and being blocked from
 * navigating anywhere else. The CSP is a second layer on top: even within
 * that boundary, it blocks outbound network requests a script might still
 * attempt.
 */
export function withSandboxedArtifactCsp(html: string, options: { email?: boolean } = {}): string {
  const csp = options.email ? SANDBOXED_EMAIL_CSP : SANDBOXED_ARTIFACT_CSP;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const leadingDoctype = html.match(PLAIN_HTML_DOCTYPE);
  if (!leadingDoctype) return `<!DOCTYPE html>${meta}${html}`;
  const end = leadingDoctype[0].length;
  return `${html.slice(0, end)}${meta}${html.slice(end)}`;
}

/**
 * Content-Security-Policy for documents the web server (and the desktop bundled renderer) serves.
 * The app talks only to its own origin: /api, /rpc, the Sentry tunnel and the /novnc screen proxy
 * all live there, so 'self' covers fetches, WebSockets and screen frames in every deployment.
 */

/** Static shell for SandboxedHtmlViewer. It must load from the network so it does not inherit the
 * app policy the way a srcdoc frame would; its own meta CSP governs it and its nested preview. */
export const HTML_VIEWER_PATH = "/html-viewer.html";

const APP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  // Mermaid SVGs and some UI libraries inject <style> elements and style attributes as markup.
  "style-src": ["'self'", "'unsafe-inline'"],
  // Markdown images, link favicons and attachment previews (object URLs).
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  // Voice replies and video attachments play from object URLs.
  "media-src": ["'self'", "blob:"],
  "connect-src": ["'self'"],
  // The /novnc screen proxy, the HTML viewer shell and PDF object URLs.
  "frame-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

function serialize(directives: Record<string, string[]>) {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export const APP_CONTENT_SECURITY_POLICY = serialize(APP_DIRECTIVES);

// The shell's meta CSP cannot restrict framing; only the app may embed it.
const HTML_VIEWER_CONTENT_SECURITY_POLICY = serialize({ "frame-ancestors": ["'self'"] });

// Proxied responses keep their own headers; the screen proxy sets its own sandbox policy.
const PASSTHROUGH_PREFIXES = ["/api", "/rpc", "/novnc"];

/** The policy header for a served path, or null when the response must keep its own policy. */
export function contentSecurityPolicyFor(pathname: string): string | null {
  if (
    PASSTHROUGH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  )
    return null;
  if (pathname === HTML_VIEWER_PATH) return HTML_VIEWER_CONTENT_SECURITY_POLICY;
  return APP_CONTENT_SECURITY_POLICY;
}

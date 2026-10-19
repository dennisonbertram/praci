// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SandboxedHtmlViewer } from "./SandboxedHtmlViewer";

async function render(html: string, scripts?: boolean, email?: boolean) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SandboxedHtmlViewer title="Notes" html={html} scripts={scripts} email={email} />);
  });
  const iframe = container.querySelector("iframe");
  return {
    iframe,
    container,
    srcDoc: iframe?.getAttribute("srcdoc") ?? "",
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
  };
}

it("keeps the preview iframe opaque and blocks remote images and fonts", async () => {
  const view = await render(
    '<img src="https://example.invalid/pixel.png"><style>@font-face { src: url(https://example.invalid/font.woff); }</style>',
  );

  expect(view.iframe?.getAttribute("sandbox")).toBe("allow-scripts");
  expect(view.iframe?.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(view.srcDoc).toContain("frame-src about:");
  expect(view.srcDoc).toContain("child-src 'none'");
  expect(view.srcDoc).toContain("img-src data:");
  expect(view.srcDoc).toContain("font-src data:");
  expect(view.srcDoc).not.toContain("allow-same-origin");
  expect(view.srcDoc).not.toMatch(/img-src[^;]*https:/);
  expect(view.srcDoc).not.toMatch(/font-src[^;]*https:/);
  expect(view.srcDoc).toContain("https://example.invalid/pixel.png");

  await view.cleanup();
});

it("runs no scripts in the preview when scripts is off, and still blocks link navigation", async () => {
  const view = await render(
    '<a href="https://example.invalid/x">link</a><script>alert(1)</script>',
    false,
  );
  const shell = view.srcDoc.split("srcdoc=")[0] ?? "";

  expect(shell).toContain('<iframe id="preview" sandbox=""');
  expect(shell).toMatch(/csp="[^"]*script-src 'none'/);
  expect(shell).not.toMatch(/csp="[^"]*unsafe-inline'; style/);
  expect(view.srcDoc).not.toContain("addEventListener");
  expect(shellContentSecurityPolicy(view.srcDoc)).toContain("frame-src about:");

  await view.cleanup();
});

it("embeds attacker markup so it cannot take over the navigation shell", async () => {
  const view = await render(
    '</script><script>location.href="https://example.invalid/nav"</script><iframe sandbox="allow-scripts allow-same-origin" src="https://example.invalid/frame"></iframe>',
  );

  const shell = view.srcDoc.split("srcdoc=")[0] ?? "";
  expect(shell).toContain('sandbox="allow-scripts"');
  expect(shell).not.toContain("allow-same-origin");
  expect(view.srcDoc).not.toContain("</script><script>");
  expect(view.srcDoc).toContain("\\u003c/script>");
  expect(shellContentSecurityPolicy(view.srcDoc)).toContain("frame-src about:");

  await view.cleanup();
});

it("lets the shell load the nested srcdoc preview and rejects http(s) navigations", async () => {
  const view = await render("<p>Hello</p>");
  const sources = operativeFrameSources(shellContentSecurityPolicy(view.srcDoc));

  expect(frameSourceAllows(sources, "about:srcdoc")).toBe(true);
  expect(frameSourceAllows(sources, "https://example.invalid/nav")).toBe(false);
  expect(frameSourceAllows(sources, "http://example.invalid/nav")).toBe(false);

  await view.cleanup();
});

it("email mode loads data and proxied images, opens links in new tabs, and still runs no script in the message", async () => {
  const view = await render('<img src="https://example.invalid/pixel.png">', true, true);
  const shell = view.srcDoc.split("srcdoc=")[0] ?? "";

  // Even when the caller asks for scripts, an email never gets them.
  expect(shell).toMatch(/csp="[^"]*script-src 'none'/);
  expect(shell).toContain(`img-src data: ${window.location.origin}`);
  expect(shell).not.toMatch(/img-src[^;]*https:/);
  // The message frame inherits the shell's policy, so the shell must not block images either.
  expect(directiveSources(shellContentSecurityPolicy(view.srcDoc), "img-src")).toEqual([
    "data:",
    window.location.origin,
  ]);
  const innerSandbox = /<iframe id="preview" sandbox="([^"]*)"/.exec(shell)?.[1] ?? "";
  expect(innerSandbox.split(" ").sort()).toEqual([
    "allow-popups",
    "allow-popups-to-escape-sandbox",
  ]);
  const outer = view.iframe?.getAttribute("sandbox")?.split(" ").sort();
  expect(outer).toEqual(["allow-popups", "allow-popups-to-escape-sandbox", "allow-scripts"]);
  // The app origin is never shared with the frame, and form posts stay blocked.
  expect(view.iframe?.getAttribute("sandbox")).not.toContain("allow-same-origin");
  expect(view.srcDoc).toContain("form-action 'none'");
  expect(view.srcDoc).toContain("base-uri 'none'");
  expect(view.srcDoc).toContain("frame-src about:");

  await view.cleanup();
});

it("leaves remote images blocked for a plain scripts-off preview", async () => {
  const view = await render('<img src="https://example.invalid/pixel.png">', false);

  expect(view.srcDoc).not.toMatch(/img-src[^;]*https:/);
  expect(directiveSources(shellContentSecurityPolicy(view.srcDoc), "img-src")).toBeUndefined();
  expect(view.iframe?.getAttribute("sandbox")).toBe("allow-scripts");

  await view.cleanup();
});

it("email mode opens http(s) links in a new tab without opener or referrer and drops other targets", async () => {
  const view = await render(
    '<a id="web" href="https://example.invalid/a">a</a>' +
      '<a id="plain" href=" HTTP://example.invalid/b">b</a>' +
      '<a id="js" href="javascript:alert(1)">c</a>' +
      '<a id="data" href="data:text/html,x">d</a>' +
      '<a id="anchor" href="#top">e</a>' +
      '<map><area id="area" href="https://example.invalid/m"></map>',
    false,
    true,
  );
  const doc = embeddedMessage(view.srcDoc);
  for (const id of ["web", "plain", "area"]) {
    const link = doc.getElementById(id);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  }
  for (const id of ["js", "data", "anchor"]) {
    expect(doc.getElementById(id)?.hasAttribute("href")).toBe(false);
    expect(doc.getElementById(id)?.hasAttribute("target")).toBe(false);
  }

  await view.cleanup();
});

it("leaves links untouched outside email mode", async () => {
  const view = await render('<a id="web" href="https://example.invalid/a">a</a>', false);

  expect(embeddedMessage(view.srcDoc).getElementById("web")?.hasAttribute("target")).toBe(false);

  await view.cleanup();
});

it("email mode still embeds attacker markup safely and keeps the script policy", async () => {
  const view = await render(
    '</script><script>location.href="https://example.invalid/nav"</script><a href="https://example.invalid/a">a</a>',
    true,
    true,
  );

  expect(view.srcDoc).not.toContain("</script><script>");
  expect(view.srcDoc).not.toContain("allow-same-origin");
  expect(view.srcDoc).not.toContain("addEventListener");
  expect(shellContentSecurityPolicy(view.srcDoc)).toContain("frame-src about:");
  expect(shellContentSecurityPolicy(view.srcDoc)).toContain("child-src 'none'");
  expect(embeddedMessage(view.srcDoc).querySelector("a")?.getAttribute("target")).toBe("_blank");

  await view.cleanup();
});

/** The message document the shell hands to the preview frame, parsed back from the shell's script. */
function embeddedMessage(srcDoc: string): Document {
  const literal = /srcdoc=(".*");<\/script>$/s.exec(srcDoc)?.[1];
  if (!literal) throw new Error("embedded message missing");
  return new DOMParser().parseFromString(JSON.parse(literal) as string, "text/html");
}

function shellContentSecurityPolicy(srcDoc: string): string {
  const match = srcDoc.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
  if (!match?.[1]) throw new Error("shell CSP missing");
  return match[1];
}

function directiveSources(policy: string, name: string): string[] | undefined {
  for (const part of policy.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens[0] !== name) continue;
    return tokens.slice(1);
  }
  return undefined;
}

function operativeFrameSources(policy: string): string[] {
  return (
    directiveSources(policy, "frame-src") ??
    directiveSources(policy, "child-src") ??
    directiveSources(policy, "default-src") ?? ["'none'"]
  );
}

function frameSourceAllows(sources: string[], rawUrl: string): boolean {
  if (sources.length === 0 || sources.includes("'none'")) return false;
  const url = new URL(rawUrl);
  return sources.some((source) => sourceAllows(source, url));
}

function sourceAllows(source: string, url: URL): boolean {
  if (source === "*") {
    return (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "ws:" ||
      url.protocol === "wss:"
    );
  }
  if (source.startsWith("'")) return false;
  if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return url.protocol === source;
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const allowed = new URL(source);
    return url.protocol === allowed.protocol && url.hostname === allowed.hostname;
  }
  return false;
}

it("email mode fits the frame width: viewport meta, max-width media and tables, scroll not clip", async () => {
  const view = await render("<table width=900><tr><td>x</td></tr></table>", false, true);

  expect(view.srcDoc).toContain("width=device-width");
  expect(view.srcDoc).toContain("img,video,table{max-width:100%!important");
  expect(view.srcDoc).toContain("overflow-x:auto");

  await view.cleanup();
  const plain = await render("<p>x</p>");
  expect(plain.srcDoc).not.toContain("width=device-width");
  await plain.cleanup();
});

it("moves focus from an email frame to the surrounding dialog when the window regains focus", async () => {
  const view = await render("<p>Hi</p>", false, true);
  view.container.setAttribute("role", "dialog");
  view.container.tabIndex = -1;
  (view.iframe as HTMLIFrameElement).tabIndex = 0;
  (view.iframe as HTMLIFrameElement).focus();
  expect(document.activeElement).toBe(view.iframe);
  window.dispatchEvent(new Event("focus"));
  expect(document.activeElement).toBe(view.container);
  await view.cleanup();
});

it("email mode shows white paper with base styles, not dimmed in dark mode", async () => {
  const email = await render("<p>hi</p>", false, true);
  const css = embeddedMessage(email.srcDoc).head.innerHTML;
  expect(css).toContain("html,body{margin:0;background:#fff;color:#1f1f1f}");
  expect(css).toContain("padding:20px 24px");
  expect(css).toContain("system-ui");
  expect(css).toContain("max-width:100%!important;height:auto");
  expect(css).toContain("overflow-wrap:anywhere");
  expect(email.iframe?.className).not.toContain("brightness");
  await email.cleanup();
  const plain = await render("<p>hi</p>");
  expect(plain.srcDoc).not.toContain("margin:0;background:#fff");
  await plain.cleanup();
});

it("email mode folds quoted replies behind a script-free toggle", async () => {
  const view = await render(
    '<p>New</p><div class="gmail_quote"><blockquote>old<blockquote>older</blockquote></blockquote></div>',
    false,
    true,
  );
  const doc = embeddedMessage(view.srcDoc);
  expect(doc.querySelectorAll("details")).toHaveLength(1);
  expect(doc.querySelector("details > summary")?.textContent).toBe("\u2026");
  expect(doc.querySelector("details > .gmail_quote")).not.toBeNull();
  await view.cleanup();
});

it("masks amounts in email HTML while Hide amounts is on, and not otherwise", async () => {
  const { setHideAmounts } = await import("../lib/hide-amounts-preference");
  const html =
    '<table><tr><td><b>Total $1,234.56</b> <img alt="Paid $1,234.56" src="data:,"></td></tr></table>';
  setHideAmounts(true);
  const hidden = await render(html, false, true);
  expect(embeddedMessage(hidden.srcDoc).body.innerHTML).not.toContain("1,234");
  expect(embeddedMessage(hidden.srcDoc).body.textContent).toContain("Total");
  await hidden.cleanup();
  setHideAmounts(false);
  const shown = await render(html, false, true);
  expect(embeddedMessage(shown.srcDoc).body.textContent).toContain("$1,234.56");
  await shown.cleanup();
});

it("email mode keeps proxied and data images, drops images that cannot load and tracking pixels", async () => {
  const proxied = "/api/inbox/image?u=https%3A%2F%2Fa.example.test%2Fa.png&t=sig";
  const view = await render(
    `<img id="ok" src="${proxied}" srcset="https://a.example.test/a2.png 2x" alt="Photo">` +
      '<img id="data" src="data:image/png;base64,AA">' +
      '<img id="direct" src="https://example.invalid/a.png" alt="">' +
      '<img id="cid" src="cid:logo" alt="">' +
      '<img id="http" src="http://example.invalid/b.png" alt="Orchard sale banner">' +
      `<img id="px" src="${proxied}" width="1" height="1" alt="Orchard pixel">` +
      '<img id="junk" src="cid:x" alt="  - ">',
    false,
    true,
  );
  const doc = embeddedMessage(view.srcDoc);
  expect(doc.getElementById("ok")?.getAttribute("src")).toBe(window.location.origin + proxied);
  expect(doc.getElementById("ok")?.hasAttribute("srcset")).toBe(false);
  expect(doc.getElementById("data")).not.toBeNull();
  for (const id of ["direct", "cid", "px", "junk", "http"])
    expect(doc.getElementById(id)).toBeNull();
  expect(doc.body.textContent).toContain("Orchard sale banner");
  expect(doc.body.textContent).not.toContain("Orchard pixel");
  await view.cleanup();
});

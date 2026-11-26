// @vitest-environment jsdom

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HTML_VIEWER_PATH } from "@rakazo/contracts/content-security-policy";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  EMAIL_HEIGHT_SCRIPT,
  EMAIL_HEIGHT_SCRIPT_HASH,
  SandboxedHtmlViewer,
} from "./SandboxedHtmlViewer";

const shell = readFileSync(
  path.join(import.meta.dirname, "../../public", HTML_VIEWER_PATH),
  "utf8",
);

interface Posted {
  srcdoc: string;
  sandbox: string;
  csp: string;
}

async function render(html: string, scripts?: boolean, email?: boolean) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SandboxedHtmlViewer title="Notes" html={html} scripts={scripts} email={email} />);
  });
  const iframe = container.querySelector("iframe");
  if (!iframe?.contentWindow) throw new Error("viewer frame missing");
  const postMessage = vi.spyOn(iframe.contentWindow, "postMessage").mockImplementation(() => {});
  const load = async () =>
    act(async () => {
      iframe.dispatchEvent(new Event("load"));
    });
  await load();
  const posted = (postMessage.mock.lastCall?.[0] ?? {}) as Posted;
  return {
    iframe,
    container,
    postMessage,
    load,
    posted,
    /** The message document the shell hands to the preview frame. */
    srcDoc: posted.srcdoc ?? "",
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    },
  };
}

it("loads the shell from the network so it does not inherit the app's CSP", async () => {
  const view = await render("<p>Hello</p>");

  expect(view.iframe.getAttribute("src")).toBe(HTML_VIEWER_PATH);
  expect(view.iframe.hasAttribute("srcdoc")).toBe(false);
  expect(view.iframe.getAttribute("sandbox")).toBe("allow-scripts");
  expect(view.iframe.getAttribute("referrerpolicy")).toBe("no-referrer");

  await view.cleanup();
});

it("posts the preview once the shell loads, and again on change or reload", async () => {
  const view = await render("<p>Hello</p>");
  expect(view.postMessage).toHaveBeenCalledTimes(1);
  expect(view.postMessage.mock.lastCall?.[1]).toBe("*");

  await view.load();
  expect(view.postMessage).toHaveBeenCalledTimes(2);

  await view.cleanup();
});

it("keeps the preview opaque and blocks remote images and fonts", async () => {
  const view = await render(
    '<img src="https://example.invalid/pixel.png"><style>@font-face { src: url(https://example.invalid/font.woff); }</style>',
  );

  expect(view.posted.sandbox).toBe("allow-scripts");
  expect(shell).toContain('referrerpolicy="no-referrer"');
  expect(shell).toContain("frame-src about:");
  expect(shell).toContain("child-src 'none'");
  expect(view.posted.csp).toContain("img-src data:");
  expect(view.posted.csp).toContain("font-src data:");
  expect(view.posted.csp).not.toMatch(/img-src[^;]*https:/);
  expect(view.posted.csp).not.toMatch(/font-src[^;]*https:/);
  expect(view.srcDoc).toContain("content=\"default-src 'none'; script-src 'unsafe-inline'");
  expect(shell).not.toContain("allow-same-origin");
  expect(view.posted.sandbox).not.toContain("allow-same-origin");
  expect(view.srcDoc).toContain("https://example.invalid/pixel.png");

  await view.cleanup();
});

it("runs no scripts in the preview when scripts is off, and still blocks link navigation", async () => {
  const view = await render(
    '<a href="https://example.invalid/x">link</a><script>alert(1)</script>',
    false,
  );

  expect(view.posted.sandbox).toBe("");
  expect(view.posted.csp).toContain("script-src 'none'");
  expect(view.posted.csp).not.toContain("unsafe-inline'; style");
  expect(view.srcDoc).not.toContain("addEventListener");
  expect(shellContentSecurityPolicy(shell)).toContain("frame-src about:");

  await view.cleanup();
});

it("renders only well-formed messages from the embedding app", () => {
  const script = shell.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error("shell script missing");
  const run = (embedded: boolean) => {
    const forwarded: unknown[] = [];
    const frameWindow = { postMessage: (data: unknown) => forwarded.push(data) };
    const attributes = new Map<string, string>();
    let onLoad: (() => void) | undefined;
    const preview = {
      srcdoc: "",
      contentWindow: frameWindow,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      addEventListener: (_type: string, handler: () => void) => {
        onLoad = handler;
      },
    };
    const self = {};
    const reports: unknown[] = [];
    const parent = embedded ? { postMessage: (data: unknown) => reports.push(data) } : self;
    let listener: ((event: { source: unknown; data: unknown }) => void) | undefined;
    new Function("addEventListener", "parent", "window", "document", script)(
      (_type: string, handler: typeof listener) => {
        listener = handler;
      },
      parent,
      self,
      { getElementById: () => preview },
    );
    return {
      preview,
      attributes,
      parent,
      frameWindow,
      reports,
      forwarded,
      load: () => onLoad?.(),
      send: (source: unknown, data: unknown) => listener?.({ source, data }),
    };
  };
  const message = { srcdoc: "<p>Hello</p>", sandbox: "allow-scripts", csp: "default-src 'none'" };

  const shellFrame = run(true);
  shellFrame.send({}, message);
  shellFrame.send(shellFrame.parent, "<p>a string</p>");
  shellFrame.send(shellFrame.parent, { ...message, sandbox: 1 });
  expect(shellFrame.preview.srcdoc).toBe("");
  shellFrame.send(shellFrame.parent, message);
  expect(shellFrame.preview.srcdoc).toBe("<p>Hello</p>");
  expect(shellFrame.attributes.get("sandbox")).toBe("allow-scripts");
  expect(shellFrame.attributes.get("csp")).toBe("default-src 'none'");

  // A frame that was not configured as an email never reports a height to the app.
  shellFrame.send(shellFrame.frameWindow, { type: "rakazo-email-height", height: 10 });
  expect(shellFrame.reports).toEqual([]);
  shellFrame.send(shellFrame.parent, { ...message, sandbox: "allow-scripts allow-popups" });
  // Only the email frame's well-formed height reports go on to the app.
  shellFrame.send({}, { type: "rakazo-email-height", height: 10 });
  shellFrame.send(shellFrame.frameWindow, { type: "other", height: 10 });
  shellFrame.send(shellFrame.frameWindow, { type: "rakazo-email-height", height: "10" });
  expect(shellFrame.reports).toEqual([]);
  shellFrame.send(shellFrame.frameWindow, { type: "rakazo-email-height", height: 10 });
  expect(shellFrame.reports).toEqual([{ type: "rakazo-email-height", height: 10 }]);

  const topLevel = run(false);
  topLevel.send(topLevel.parent, message);
  expect(topLevel.preview.srcdoc).toBe("");

  // Data for an HTML page goes into the frame only from the app, as exactly {type, sources}.
  const bridge = run(true);
  const data = { type: "praci-data", sources: { Cash: { status: "ok" } }, extra: "x" };
  bridge.send({}, data);
  bridge.send(bridge.frameWindow, data);
  bridge.send(bridge.parent, { ...data, type: "praci-data2" });
  bridge.send(bridge.parent, { sources: {} });
  expect(bridge.forwarded).toEqual([]);
  expect(bridge.reports).toEqual([]);
  bridge.send(bridge.parent, data);
  expect(bridge.forwarded).toEqual([{ type: "praci-data", sources: { Cash: { status: "ok" } } }]);
  expect(bridge.reports).toEqual([]);

  // Nothing from the frame reaches the app but height reports; the shell's own load ping carries no data.
  bridge.send(bridge.frameWindow, { type: "praci-viewer-ready", leak: "secret" });
  bridge.send(bridge.frameWindow, { type: "praci-data", sources: {} });
  bridge.send(bridge.frameWindow, { srcdoc: "<p>x</p>", sandbox: "allow-same-origin", csp: "" });
  expect(bridge.reports).toEqual([]);
  expect(bridge.preview.srcdoc).toBe("");
  bridge.load();
  expect(bridge.reports).toEqual([{ type: "praci-viewer-ready" }]);
});

it("switches DNS prefetch off first, in the shell and in every preview document", async () => {
  const off = '<meta http-equiv="x-dns-prefetch-control" content="off">';
  expect(shell.indexOf(off)).toBeGreaterThanOrEqual(0);
  expect(shell.startsWith(`<!DOCTYPE html>${off}`)).toBe(true);
  for (const [scripts, email] of [
    [true, false],
    [false, false],
    [false, true],
  ] as const) {
    const view = await render('<link rel="dns-prefetch" href="//x.example">', scripts, email);
    expect(view.srcDoc.startsWith(off)).toBe(true);
    await view.cleanup();
  }
});

it("pushes data to the shell after the frame is ready and whenever it changes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const show = async (data?: Record<string, unknown>) =>
    act(async () => {
      root.render(<SandboxedHtmlViewer title="Page" html="<p>x</p>" data={data} />);
    });
  await show({ Cash: { status: "ok", value: 1 } });
  const iframe = container.querySelector("iframe");
  if (!iframe?.contentWindow) throw new Error("viewer frame missing");
  const postMessage = vi.spyOn(iframe.contentWindow, "postMessage").mockImplementation(() => {});
  const dataPosts = () =>
    postMessage.mock.calls.map(([message]) => message).filter((m) => m?.type === "praci-data");
  const fromFrame = async (source: unknown, data: unknown) =>
    act(async () => {
      window.dispatchEvent(new MessageEvent("message", { source: source as Window, data }));
    });

  await act(async () => {
    iframe.dispatchEvent(new Event("load"));
  });
  // Not before the shell reports a loaded document, and never for a message from anywhere else.
  expect(dataPosts()).toEqual([]);
  await fromFrame(window, { type: "praci-viewer-ready" });
  await fromFrame(iframe.contentWindow, { type: "something-else" });
  expect(dataPosts()).toEqual([]);

  await fromFrame(iframe.contentWindow, { type: "praci-viewer-ready" });
  expect(dataPosts()).toEqual([
    { type: "praci-data", sources: { Cash: { status: "ok", value: 1 } } },
  ]);
  expect(postMessage.mock.lastCall?.[1]).toBe("*");

  await show({ Cash: { status: "ok", value: 2 } });
  expect(dataPosts()).toHaveLength(2);
  expect(dataPosts()[1]).toEqual({
    type: "praci-data",
    sources: { Cash: { status: "ok", value: 2 } },
  });

  // A new document in the frame needs the data again.
  await fromFrame(iframe.contentWindow, { type: "praci-viewer-ready" });
  expect(dataPosts()).toHaveLength(3);

  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("posts data that arrives after the frame's ready ping", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const show = async (data?: Record<string, unknown>) =>
    act(async () => {
      root.render(<SandboxedHtmlViewer title="Page" html="<p>x</p>" data={data} />);
    });
  await show(undefined);
  const iframe = container.querySelector("iframe");
  if (!iframe?.contentWindow) throw new Error("viewer frame missing");
  const postMessage = vi.spyOn(iframe.contentWindow, "postMessage").mockImplementation(() => {});
  const dataPosts = () =>
    postMessage.mock.calls.map(([message]) => message).filter((m) => m?.type === "praci-data");

  await act(async () => {
    iframe.dispatchEvent(new Event("load"));
  });
  // The frame reports ready while the data request is still in flight.
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow as Window,
        data: { type: "praci-viewer-ready" },
      }),
    );
  });
  expect(dataPosts()).toEqual([]);

  await show({ Cash: { status: "ok", value: 1 } });
  expect(dataPosts()).toEqual([
    { type: "praci-data", sources: { Cash: { status: "ok", value: 1 } } },
  ]);

  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("lets the shell load the nested srcdoc preview and rejects http(s) navigations", () => {
  const sources = operativeFrameSources(shellContentSecurityPolicy(shell));

  expect(frameSourceAllows(sources, "about:srcdoc")).toBe(true);
  expect(frameSourceAllows(sources, "https://example.invalid/nav")).toBe(false);
  expect(frameSourceAllows(sources, "http://example.invalid/nav")).toBe(false);
});

it("email mode loads data and proxied images, opens links in new tabs, and still runs no script in the message", async () => {
  const view = await render('<img src="https://example.invalid/pixel.png">', true, true);

  // Even when the caller asks for scripts, an email's own scripts never run: the message frame
  // allows exactly one pinned script (the height reporter) and nothing inline.
  expect(directiveSources(view.posted.csp, "script-src")).toEqual([
    `'${EMAIL_HEIGHT_SCRIPT_HASH}'`,
  ]);
  expect(view.posted.csp).not.toMatch(
    /unsafe-(inline|hashes)[^;]*script|script-src[^;]*unsafe-inline/,
  );
  expect(directiveSources(view.posted.csp, "img-src")).toEqual(["data:", window.location.origin]);
  expect(view.posted.csp).not.toMatch(/img-src[^;]*https:/);
  // The message frame inherits the shell's policy, so the shell must not block the image proxy.
  expect(directiveSources(shellContentSecurityPolicy(shell), "img-src")).toEqual([
    "data:",
    "'self'",
  ]);
  // allow-scripts runs only the pinned height script; without allow-same-origin the frame stays opaque.
  expect(view.posted.sandbox.split(" ").sort()).toEqual([
    "allow-popups",
    "allow-popups-to-escape-sandbox",
    "allow-scripts",
  ]);
  const outer = view.iframe.getAttribute("sandbox")?.split(" ").sort();
  expect(outer).toEqual(["allow-popups", "allow-popups-to-escape-sandbox", "allow-scripts"]);
  // The app origin is never shared with the frame, and form posts stay blocked.
  expect(view.iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
  expect(view.posted.sandbox).not.toContain("allow-same-origin");
  expect(view.posted.csp).toContain("form-action 'none'");
  expect(view.posted.csp).toContain("base-uri 'none'");

  await view.cleanup();
});

it("leaves remote images blocked for a plain scripts-off preview", async () => {
  const view = await render('<img src="https://example.invalid/pixel.png">', false);

  expect(directiveSources(view.posted.csp, "img-src")).toEqual(["data:"]);
  expect(view.iframe.getAttribute("sandbox")).toBe("allow-scripts");

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
  // The only script left in the message is the pinned height reporter.
  const scripts = [...embeddedMessage(view.srcDoc).querySelectorAll("script")];
  expect(scripts.map((script) => script.textContent)).toEqual([EMAIL_HEIGHT_SCRIPT]);
  expect(shellContentSecurityPolicy(shell)).toContain("frame-src about:");
  expect(shellContentSecurityPolicy(shell)).toContain("child-src 'none'");
  expect(embeddedMessage(view.srcDoc).querySelector("a")?.getAttribute("target")).toBe("_blank");

  await view.cleanup();
});

it("pins the height script by its exact SHA-256 hash", () => {
  const digest = createHash("sha256").update(EMAIL_HEIGHT_SCRIPT, "utf8").digest("base64");
  expect(EMAIL_HEIGHT_SCRIPT_HASH).toBe(`sha256-${digest}`);
});

it("email mode strips the message's own scripts and inline handlers", async () => {
  const view = await render(
    '<img src="data:image/png;base64,AA==" onload="alert(1)"><p onclick="alert(2)">x</p><script>alert(3)</script>',
    false,
    true,
  );
  const doc = embeddedMessage(view.srcDoc);
  expect(doc.body.innerHTML).not.toMatch(/on(load|click)=|alert\(/);
  expect([...doc.querySelectorAll("script")].map((s) => s.textContent)).toEqual([
    EMAIL_HEIGHT_SCRIPT,
  ]);
  await view.cleanup();
});

it("email mode sizes the frame from height messages sent only by its own frame", async () => {
  const view = await render("<p>Hi</p>", false, true);
  const iframe = view.iframe as HTMLIFrameElement;
  const post = async (data: unknown, source: MessageEventSource | null) =>
    act(async () => {
      window.dispatchEvent(new MessageEvent("message", { data, source }));
    });

  await post({ type: "rakazo-email-height", height: 480 }, iframe.contentWindow);
  expect(iframe.style.height).toBe("480px");
  // Another window, a wrong shape, or a bad number never changes the size.
  await post({ type: "rakazo-email-height", height: 900 }, window);
  await post({ type: "other", height: 900 }, iframe.contentWindow);
  await post({ type: "rakazo-email-height", height: Number.NaN }, iframe.contentWindow);
  await post({ type: "rakazo-email-height", height: -5 }, iframe.contentWindow);
  expect(iframe.style.height).toBe("480px");
  // Absurd heights are capped.
  await post({ type: "rakazo-email-height", height: 10_000_000 }, iframe.contentWindow);
  expect(Number.parseInt(iframe.style.height, 10)).toBeLessThanOrEqual(20_000);
  await view.cleanup();
});

/** The message document the shell hands to the preview frame, parsed. */
function embeddedMessage(srcDoc: string): Document {
  return new DOMParser().parseFromString(srcDoc, "text/html");
}

function shellContentSecurityPolicy(html: string): string {
  const match = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
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
  expect(css).toContain("html{overflow-x:auto;padding:24px 32px!important}");
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

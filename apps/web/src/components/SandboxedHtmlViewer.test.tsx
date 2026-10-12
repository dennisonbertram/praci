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

it("email mode loads https and data images, opens links in new tabs, and still runs no script in the message", async () => {
  const view = await render('<img src="https://example.invalid/pixel.png">', true, true);
  const shell = view.srcDoc.split("srcdoc=")[0] ?? "";

  // Even when the caller asks for scripts, an email never gets them.
  expect(shell).toMatch(/csp="[^"]*script-src 'none'/);
  expect(shell).toMatch(/csp="[^"]*img-src data: https:/);
  const innerSandbox = /<iframe id="preview" sandbox="([^"]*)"/.exec(shell)?.[1] ?? "";
  expect(innerSandbox.split(" ").sort()).toEqual([
    "allow-popups",
    "allow-popups-to-escape-sandbox",
    "allow-same-origin",
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
  expect(view.iframe?.getAttribute("sandbox")).toBe("allow-scripts");

  await view.cleanup();
});

it("email mode sizes the frame to the height its shell reports, within limits", async () => {
  const view = await render("<p>Hello</p>", false, true);
  const frame = view.iframe as HTMLIFrameElement;
  const report = async (data: unknown, source: MessageEventSource | null = frame.contentWindow) => {
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", { data, source }));
    });
  };

  await report({ rakazoHeight: 412 });
  expect(frame.style.height).toBe("412px");
  // A message from anywhere else, or a value that is not a finite number, is ignored.
  await report({ rakazoHeight: 900 }, window);
  await report({ rakazoHeight: "900" });
  await report({ rakazoHeight: Number.NaN });
  await report("rakazoHeight");
  expect(frame.style.height).toBe("412px");
  await report({ rakazoHeight: 10 });
  expect(Number.parseInt(frame.style.height)).toBeGreaterThanOrEqual(40);
  await report({ rakazoHeight: 1_000_000 });
  expect(Number.parseInt(frame.style.height)).toBeLessThanOrEqual(4000);

  await view.cleanup();
});

it("does not size a non-email preview from messages", async () => {
  const view = await render("<p>Hello</p>");
  const frame = view.iframe as HTMLIFrameElement;
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", { data: { rakazoHeight: 300 }, source: frame.contentWindow }),
    );
  });
  expect(frame.style.height).toBe("");

  await view.cleanup();
});

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

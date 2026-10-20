/**
 * Runs before the app in the homepage demo (demo.html). The app is the real one, with its real RPC
 * client: this file only answers its network requests from fixture.json, so everything runs in
 * the browser on invented data and nothing reaches a service. fixture.json is recorded from the
 * mock demo stack by `pnpm --filter @rakazo/web record:demo`.
 */
import fixture from "./fixture.json";

type Recorded = { input: string; status: number; body: string };
const rpc = fixture.rpc as Record<string, Recorded[]>;
const streams = new Set<string>(fixture.streams);

// The fixture is a snapshot, so the clock starts at the moment it was recorded and then runs.
const RealDate = Date;
const offset = fixture.recordedAt - RealDate.now();
class DemoDate extends RealDate {
  constructor(...args: unknown[]) {
    // @ts-expect-error spreading into the overloaded Date constructor
    super(...(args.length === 0 ? [RealDate.now() + offset] : args));
  }
  static override now() {
    return RealDate.now() + offset;
  }
}
globalThis.Date = DemoDate as DateConstructor;

try {
  localStorage.setItem("rakazo.uiAppearance", "dark");
} catch {
  // The demo still renders without storage.
}
// The app lives under /app; the page itself is served from /demo/.
if (!location.pathname.startsWith("/app")) history.replaceState(null, "", "/app/finance");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const readOnly = () =>
  json(
    { json: { defined: false, code: "FORBIDDEN", status: 403, message: "Read-only demo" } },
    403,
  );

function answer(pathname: string, body: string): Response {
  if (pathname === "/api/auth/get-session") return json(fixture.session);
  if (pathname === "/api/auth/capabilities") return json(fixture.capabilities);
  if (!pathname.startsWith("/rpc/")) return json(null, 404);
  const key = pathname.slice("/rpc".length);
  const recorded = rpc[key];
  // An exact input match, else the first answer for that procedure (a view the walk did not reach).
  const hit = recorded?.find((entry) => entry.input === body) ?? recorded?.[0];
  if (hit)
    return new Response(hit.body, {
      status: hit.status,
      headers: { "content-type": "application/json" },
    });
  if (streams.has(key)) {
    // A live feed that never sends anything: the demo has no server to push changes.
    return new Response(new ReadableStream({ start() {} }), {
      headers: { "content-type": "text/event-stream" },
    });
  }
  return readOnly();
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  // Only the page's own static assets may be fetched; every other request is answered here.
  if (
    url.origin === location.origin &&
    !url.pathname.startsWith("/rpc/") &&
    !url.pathname.startsWith("/api/")
  ) {
    return realFetch(request);
  }
  if (url.origin !== location.origin) return Promise.reject(new TypeError("Offline demo"));
  return answer(url.pathname, await request.text());
};
navigator.sendBeacon = () => true;
for (const name of ["WebSocket", "EventSource", "XMLHttpRequest"] as const) {
  Object.defineProperty(window, name, {
    value: function Blocked() {
      throw new Error("Offline demo");
    },
  });
}

// Logos ship with the demo under /demo/logos; images from other sites show their letter fallback.
const rewrite = (value: string) =>
  value.startsWith("/logos/")
    ? `/demo${value}`
    : /^https?:\/\//.test(value) && !value.startsWith(location.origin)
      ? "data:,"
      : value;
const setAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name: string, value: string) {
  return setAttribute.call(
    this,
    name,
    this instanceof HTMLImageElement && name === "src" ? rewrite(value) : value,
  );
};
const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
if (src?.set) {
  const set = src.set;
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...src,
    set(value: string) {
      set.call(this, rewrite(value));
    },
  });
}

// Opening the app would scroll the sidebar to the space header; the demo opens at the top.
const scrollIntoView = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function (arg) {
  if (!this.hasAttribute("data-sidebar-current")) scrollIntoView.call(this, arg);
};

// The page embeds the demo below the fold: nothing may take focus (and so scroll the page) until
// the visitor touches it.
let touched = false;
for (const type of ["pointerdown", "keydown"]) addEventListener(type, () => (touched = true), true);
const focus = HTMLElement.prototype.focus;
HTMLElement.prototype.focus = function (options) {
  if (touched) focus.call(this, options);
};

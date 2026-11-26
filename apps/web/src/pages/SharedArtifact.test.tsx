// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/PdfViewer", () => ({ PdfViewer: () => <div>PDF preview</div> }));

import { SharedArtifactPage } from "./SharedArtifact";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  act(() => root.unmount());
  document.title = "";
  container.remove();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const render = async () => {
  await act(async () => root.render(<SharedArtifactPage />));
  await act(async () => undefined);
};

it("shows shared HTML in an isolated frame: scripts allowed, no allow-same-origin", async () => {
  window.location.hash = "#tok";
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      name: "Dash.html",
      mimeType: "text/html",
      contentBase64: btoa("<h1>Hi</h1>"),
    }),
  );
  await render();
  expect(fetch).toHaveBeenCalledWith(
    "/api/share/open",
    expect.objectContaining({
      method: "POST",
      credentials: "omit",
      body: JSON.stringify({ token: "tok" }),
    }),
  );
  const frame = container.querySelector("iframe");
  expect(container.querySelector("h1")?.getAttribute("title")).toBe("Dash.html");
  expect(frame).not.toBeNull();
  const sandbox = frame?.getAttribute("sandbox") ?? "";
  expect(sandbox).toContain("allow-scripts");
  expect(sandbox).not.toContain("allow-same-origin");
  expect(container.textContent).toContain("Shared from Praci");
});

it("says one sentence when the link is refused or missing", async () => {
  window.location.hash = "#nope";
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: "gone" }, { status: 404 }));
  await render();
  expect(container.textContent).toBe("This link is not available.");
  expect(container.querySelector("iframe")).toBeNull();
});

it.each([400, 403, 404, 410])(
  "keeps a %i response indistinguishable from an unavailable link",
  async (status) => {
    window.location.hash = "#nope";
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: "gone" }, { status }));
    await render();
    expect(container.textContent).toBe("This link is not available.");
    expect(container.textContent).not.toContain("Try again");
  },
);

it("offers a retry when the share endpoint is rate limited", async () => {
  window.location.hash = "#tok";
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ error: "limited" }, { status: 429 }))
    .mockResolvedValueOnce(
      Response.json({
        name: "Recovered.html",
        mimeType: "text/html",
        contentBase64: btoa("<h1>Recovered</h1>"),
      }),
    );
  await render();
  expect(container.textContent).toContain("Try again");
  expect(container.textContent).not.toContain("This link is not available.");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  expect(container.textContent).toContain("Recovered");
  expect(container.querySelector("iframe")).not.toBeNull();
});

it("offers a retry after a temporary failure and shows the artifact when retry succeeds", async () => {
  window.location.hash = "#tok";
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ error: "failure" }, { status: 500 }))
    .mockResolvedValueOnce(
      Response.json({
        name: "Recovered.html",
        mimeType: "text/html",
        contentBase64: btoa("<h1>Recovered</h1>"),
      }),
    );
  await render();
  expect(container.textContent).toContain("Could not load");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("Recovered");
  expect(container.querySelector("iframe")).not.toBeNull();
});

it("offers a retry after a network failure", async () => {
  window.location.hash = "#tok";
  vi.mocked(fetch).mockRejectedValue(new TypeError("network error"));
  await render();
  expect(container.textContent).toContain("Could not load");
  expect(container.textContent).toContain("Try again");
});

it("treats an address with no token as a dead link without asking the server", async () => {
  window.location.hash = "";
  await render();
  expect(container.textContent).toBe("This link is not available.");
  expect(fetch).not.toHaveBeenCalled();
});

it("follows a changed share hash and ignores the previous response", async () => {
  window.location.hash = "#a";
  let resolveA!: (response: Response) => void;
  let resolveB!: (response: Response) => void;
  vi.mocked(fetch)
    .mockImplementationOnce(() => new Promise((resolve) => (resolveA = resolve)))
    .mockImplementationOnce(() => new Promise((resolve) => (resolveB = resolve)));

  await render();
  window.history.replaceState(null, "", "/#b");
  await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")));
  await act(async () =>
    resolveB(
      Response.json({
        name: "B.html",
        mimeType: "text/html",
        contentBase64: btoa("<h1>B content</h1>"),
      }),
    ),
  );
  await act(async () =>
    resolveA(
      Response.json({
        name: "A.html",
        mimeType: "text/html",
        contentBase64: btoa("<h1>A content</h1>"),
      }),
    ),
  );

  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    "/api/share/open",
    expect.objectContaining({ body: JSON.stringify({ token: "b" }) }),
  );
  expect(container.querySelector("header h1")?.getAttribute("title")).toBe("B.html");
  expect(document.title).toBe("B");
  expect(container.textContent).not.toContain("A");
});

it("ignores a late failure from the previous share hash", async () => {
  window.location.hash = "#a";
  let resolveA!: (response: Response) => void;
  let resolveB!: (response: Response) => void;
  vi.mocked(fetch)
    .mockImplementationOnce(() => new Promise((resolve) => (resolveA = resolve)))
    .mockImplementationOnce(() => new Promise((resolve) => (resolveB = resolve)));

  await render();
  window.history.replaceState(null, "", "/#b");
  await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")));
  await act(async () =>
    resolveB(
      Response.json({
        name: "B.html",
        mimeType: "text/html",
        contentBase64: btoa("<h1>B content</h1>"),
      }),
    ),
  );
  await act(async () => resolveA(Response.json({ error: "failure" }, { status: 500 })));

  expect(container.querySelector("header h1")?.getAttribute("title")).toBe("B.html");
  expect(container.textContent).not.toContain("Try again");
});

it("lets a recipient download a shared PDF using its existing bytes", async () => {
  window.location.hash = "#tok";
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      name: "report.final.pdf",
      mimeType: "application/pdf",
      contentBase64: btoa("pdf-bytes"),
    }),
  );
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shared-pdf");
  let clickedAnchor: HTMLAnchorElement | undefined;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedAnchor = this;
  });

  await render();
  const download = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Download",
  );
  expect(download).toBeDefined();
  await act(async () => download?.click());

  expect(createObjectURL).toHaveBeenCalledTimes(1);
  const blob = createObjectURL.mock.calls[0]?.[0];
  expect(blob).toBeInstanceOf(Blob);
  expect((blob as Blob | undefined)?.type).toBe("application/pdf");
  expect(clickedAnchor?.download).toBe("report.final.pdf");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("saves a download under its type's extension, not the stored name's", async () => {
  window.location.hash = "#tok";
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ name: "report.html", mimeType: "image/png", contentBase64: btoa("x") }),
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shared-png");
  let clickedAnchor: HTMLAnchorElement | undefined;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedAnchor = this;
  });

  await render();
  const download = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Download",
  );
  await act(async () => download?.click());

  expect(clickedAnchor?.download).toBe("report.png");
});

it("does not offer a download button for a shared HTML artifact", async () => {
  window.location.hash = "#tok";
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      name: "report.html",
      mimeType: "text/html",
      contentBase64: btoa("<h1>Safe preview</h1>"),
    }),
  );

  await render();

  expect(
    [...container.querySelectorAll("button")].some((button) => button.textContent === "Download"),
  ).toBe(false);
});

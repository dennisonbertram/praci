// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { openArtifactBytes } from "./artifact-open";

vi.mock("./rpc", () => ({ rpc: {} }));

const bytes = (text: string) => new TextEncoder().encode(text);

function fakeTab() {
  const doc = document.implementation.createHTMLDocument("");
  const tab = { document: doc, opener: window, close: vi.fn() } as unknown as Window;
  vi.spyOn(window, "open").mockReturnValue(tab);
  return { tab, doc };
}

function stubUrls() {
  URL.createObjectURL = vi.fn(() => "blob:http://x/1");
  URL.revokeObjectURL = vi.fn();
  return vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
}

afterEach(() => vi.restoreAllMocks());

it("shows Markdown as inert text in a new tab, with a save link under the real name", async () => {
  const { tab, doc } = fakeTab();
  const click = stubUrls();
  await openArtifactBytes("notes.md", "text/markdown", () => bytes("# Hi <b>x</b>"));
  expect(window.open).toHaveBeenCalledWith("", "_blank");
  expect(tab.opener).toBeNull();
  expect(doc.title).toBe("notes.md");
  expect(doc.querySelector("pre")?.textContent).toBe("# Hi <b>x</b>");
  expect(doc.querySelector("pre b")).toBeNull();
  const save = doc.querySelector("a");
  expect(save?.download).toBe("notes.md");
  expect(click).not.toHaveBeenCalled();
});

it("opens the tab before the bytes arrive", async () => {
  fakeTab();
  stubUrls();
  let release!: (value: Uint8Array) => void;
  const pending = openArtifactBytes("a.txt", "text/plain", () => new Promise((r) => (release = r)));
  expect(window.open).toHaveBeenCalledTimes(1);
  release(bytes("x"));
  await pending;
});

it("never runs HTML or SVG on the app's origin: it downloads instead of opening a tab", async () => {
  const open = vi.spyOn(window, "open");
  const click = stubUrls();
  for (const [name, type] of [
    ["page.html", "text/html"],
    ["pic.svg", "image/svg+xml"],
    ["data.xml", "application/xml"],
    ["x.html", "application/octet-stream; charset=utf-8, text/html"],
  ] as const) {
    await openArtifactBytes(name, type, () => bytes("<script>alert(1)</script>"));
  }
  expect(open).not.toHaveBeenCalled();
  expect(click).toHaveBeenCalledTimes(4);
});

it("types the blob from the allowlist, not the stored type", async () => {
  fakeTab();
  stubUrls();
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((blob) => (blobs.push(blob as Blob), "blob:http://x/1"));
  await openArtifactBytes("notes.md", "text/markdown; charset=utf-8", () => bytes("x"));
  expect(blobs[0]?.type).toBe("text/plain");
});

it("falls back to a download when the tab is refused", async () => {
  vi.spyOn(window, "open").mockReturnValue(null);
  const click = stubUrls();
  await openArtifactBytes("notes.md", "text/markdown", () => bytes("x"));
  expect(click).toHaveBeenCalled();
});

it("closes the tab and rethrows when loading fails", async () => {
  const { tab } = fakeTab();
  stubUrls();
  await expect(
    openArtifactBytes("notes.md", "text/markdown", async () => {
      throw new Error("nope");
    }),
  ).rejects.toThrow("nope");
  expect(tab.close).toHaveBeenCalled();
});

it("shows PDFs in a frame and images in an img", async () => {
  const pdf = fakeTab();
  stubUrls();
  await openArtifactBytes("a.pdf", "application/pdf", () => bytes("%PDF"));
  expect(pdf.doc.querySelector("iframe")?.getAttribute("src")).toBe("blob:http://x/1");
  const img = fakeTab();
  await openArtifactBytes("a.png", "image/png", () => bytes("png"));
  expect(img.doc.querySelector("img")).not.toBeNull();
});

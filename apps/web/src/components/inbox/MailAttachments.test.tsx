// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), ""),
}));
vi.mock("../PdfViewer", () => ({ PdfViewer: () => <div data-testid="pdf" /> }));
vi.mock("../SheetPreview", () => ({
  SheetPreview: ({ source }: { source: unknown }) => (
    <div data-testid="sheet">{JSON.stringify(source)}</div>
  ),
}));
vi.mock("../ArtifactPreview", () => ({
  ArtifactPreview: ({ artifact }: { artifact: { mimeType: string } }) => (
    <div data-testid="artifact">{artifact.mimeType}</div>
  ),
}));
const emailImported = vi.fn();
const importEmail = vi.fn();
vi.mock("../../lib/rpc", () => ({
  rpc: {
    dataRoom: {
      emailImported: (input: unknown) => emailImported(input),
      importEmail: (input: unknown) => importEmail(input),
    },
  },
  withSpaceHeaders: () => new Headers({ "x-rakazo-space-id": "space_demo" }),
}));
vi.mock("../../lib/data-room", () => ({ dataRoomImportStarted: () => {} }));

import { MailAttachments, PREVIEW_MAX_BYTES } from "./MailAttachments";

const file = (id: string, filename: string, mimeType: string, size = 1000) => ({
  id,
  filename,
  mimeType,
  size,
});
const attachments = [
  file("a1", "report.pdf", "application/pdf"),
  file("a2", "photo.png", "image/png", 600 * 1024),
  file("a3", "numbers.csv", "text/csv"),
  file("a4", "bundle.zip", "application/zip"),
  file("a5", "huge.pdf", "application/pdf", PREVIEW_MAX_BYTES + 1),
];

const fetchMock = vi.fn();
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetchMock);
  emailImported.mockReset().mockResolvedValue({ files: [] });
  importEmail.mockReset().mockResolvedValue({ imported: 1, duplicates: 0, failed: 0 });
  URL.createObjectURL = () => "blob:demo";
  URL.revokeObjectURL = () => {};
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
async function show() {
  await act(async () => root.render(<MailAttachments messageId="m1" attachments={attachments} />));
  await flush();
}
const chip = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("ul button")].find((b) =>
    b.textContent?.includes(name),
  ) as HTMLButtonElement;
async function open(name: string) {
  await act(async () => chip(name).click());
  await flush();
}
const key = (k: string) =>
  act(async () => {
    document
      .querySelector("[role=dialog]")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });
const scopedUrl = (id: string) => `/api/inbox/messages/m1/attachments/${id}`;

it("opens a PDF through the scoped attachment route", async () => {
  await show();
  await open("report.pdf");
  expect(document.querySelector("[data-testid=pdf]")).not.toBeNull();
  const urls = fetchMock.mock.calls.map(([url]) => url);
  expect(urls).toContain(scopedUrl("a1"));
  expect(urls.every((url) => String(url).startsWith("/api/inbox/messages/m1/attachments/"))).toBe(
    true,
  );
});

it("opens an image", async () => {
  await show();
  await open("photo.png");
  expect(document.querySelector("[data-testid=artifact]")?.textContent).toBe("image/png");
});

it("opens a sheet from the mail attachment, not from bytes", async () => {
  await show();
  fetchMock.mockClear();
  await open("numbers.csv");
  expect(document.querySelector("[data-testid=sheet]")?.textContent).toContain(
    '"attachmentId":"a3"',
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows Download for a type with no preview", async () => {
  await show();
  await open("bundle.zip");
  expect(document.body.textContent).toContain("Preview isn't available for this file type");
  expect(
    [...document.querySelectorAll("[role=dialog] button")].some(
      (b) => b.textContent === "Download",
    ),
  ).toBe(true);
});

it("does not fetch a file over the size limit", async () => {
  await show();
  fetchMock.mockClear();
  await open("huge.pdf");
  expect(document.body.textContent).toContain("Too large to preview");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("steps between attachments with the arrow keys", async () => {
  await show();
  await open("report.pdf");
  const title = () => document.querySelector("[role=dialog] [id]")?.textContent;
  expect(document.body.textContent).toContain("report.pdf");
  await key("ArrowRight");
  expect(document.querySelector("[data-testid=artifact]")?.textContent).toBe("image/png");
  await key("ArrowLeft");
  expect(document.querySelector("[data-testid=pdf]")).not.toBeNull();
  void title;
});

it("shows previous and next arrows for several attachments but not for one", async () => {
  await show();
  await open("report.pdf");
  expect(document.querySelector('[aria-label="Next attachment"]')).not.toBeNull();
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () =>
    root.render(<MailAttachments messageId="m1" attachments={attachments.slice(0, 1)} />),
  );
  await flush();
  await open("report.pdf");
  expect(document.querySelector("[role=dialog]")).not.toBeNull();
  expect(document.querySelector('[aria-label="Next attachment"]')).toBeNull();
  expect(document.querySelector('[aria-label="Previous attachment"]')).toBeNull();
});

it("adds to the Data room once, however often it is clicked", async () => {
  await show();
  await open("report.pdf");
  const add = () =>
    [...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find(
      (b) => b.textContent === "Add to Data room" || b.textContent === "Added",
    ) as HTMLButtonElement;
  await act(async () => {
    add().click();
    add().click();
  });
  await flush();
  expect(importEmail).toHaveBeenCalledTimes(1);
  expect(importEmail).toHaveBeenCalledWith({ picks: [{ messageId: "m1", attachmentId: "a1" }] });
  expect(add().textContent).toBe("Added");
  expect(document.querySelector("[role=status]")?.textContent).toContain("Added to Data room");
});

it("shows Added for an attachment already in the Data room", async () => {
  emailImported.mockResolvedValue({ files: [{ messageId: "m1", attachmentId: "a1" }] });
  await show();
  await open("report.pdf");
  const button = [...document.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find(
    (b) => b.textContent === "Added",
  );
  expect(button?.disabled).toBe(true);
});

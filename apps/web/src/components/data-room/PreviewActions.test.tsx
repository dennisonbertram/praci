// @vitest-environment jsdom

import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const direct = vi.hoisted(() => vi.fn());
vi.mock("../../lib/data-room", async (original) => ({
  ...(await original<typeof import("../../lib/data-room")>()),
  openDataRoomFileDirect: direct,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { FileViewer, PreviewActions } from "./PreviewActions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (name: string, mimeType: string) =>
  ({ id: "i1", name, mimeType, size: 100 }) as DataRoomApiItem;
let container: HTMLDivElement | undefined;

afterEach(() => {
  container?.remove();
  container = undefined;
  setHideAmounts(false);
});

function render(node: DataRoomApiItem, url = "blob:file", failed = false) {
  container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container as HTMLDivElement).render(
      <FileViewer item={node} file={{ url, failed }} />,
    ),
  );
  return container;
}

it("hides the browser PDF toolbar so only the app's Open and Download show", () => {
  const frame = render(item("agreement.pdf", "application/pdf")).querySelector("iframe");
  expect(frame?.getAttribute("src")).toBe("blob:file#toolbar=0");
});

it("plays a recording in the browser's audio controls", () => {
  const audio = render(item("Recording 29 Oct 09:14", "audio/ogg")).querySelector("audio");
  expect(audio?.getAttribute("src")).toBe("blob:file");
  expect(audio?.hasAttribute("controls")).toBe(true);
});

it("gives a PDF Open and Download below sm, where the frame would be blank", () => {
  const view = render(item("agreement.pdf", "application/pdf"));
  expect(view.querySelector("iframe")?.className).toContain("max-sm:hidden");
  const labels = Array.from(view.querySelectorAll("button")).map((b) => b.textContent);
  expect(labels).toEqual(["Open", "Download"]);
});

it("opens the PDF on a phone by going straight to the file, not a frame in a new tab", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const view = render(item("agreement.pdf", "application/pdf"));
  act(() => view.querySelector("button")?.click());
  expect(open).toHaveBeenCalledWith("blob:file", "_blank", "noopener");
  open.mockRestore();
});

it("leaves an image URL unchanged", () => {
  const image = render(item("receipt.png", "image/png")).querySelector("img");
  expect(image?.getAttribute("src")).toBe("blob:file");
});

it("shows a PDF's Open and Download at once, before the file has loaded", () => {
  const view = render(item("agreement.pdf", "application/pdf"), "");
  const labels = Array.from(view.querySelectorAll("button")).map((b) => b.textContent);
  expect(labels).toEqual(["Open", "Download"]);
  expect(view.querySelector('[data-testid="preview-skeleton"]')?.className).toContain(
    "max-sm:hidden",
  );
});

it("before the file loads, Open goes straight to the file, not the frame helper", () => {
  direct.mockResolvedValue(undefined);
  const view = render(item("agreement.pdf", "application/pdf"), "");
  act(() => view.querySelector("button")?.click());
  expect(direct).toHaveBeenCalledTimes(1);
});

it("hides the header Open and Download below sm only where the PDF shows its own", () => {
  const draw = (node: DataRoomApiItem, failed = false) => {
    const host = document.createElement("div");
    document.body.append(host);
    act(() =>
      createRoot(host).render(
        <PreviewActions
          item={node}
          file={{ url: "blob:file", failed }}
          hidden={false}
          onError={() => undefined}
        />,
      ),
    );
    const hidden = (label: string) =>
      host.querySelector(`button[aria-label="${label}"]`)?.className.includes("max-sm:hidden");
    host.remove();
    return [hidden("Open in new tab"), hidden("Download")];
  };
  expect(draw(item("a.pdf", "application/pdf"))).toEqual([true, true]);
  expect(draw(item("a.pdf", "application/pdf"), true)).toEqual([false, false]);
  expect(draw(item("a.png", "image/png"))).toEqual([false, false]);
});

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const docx = (previewText: string | null) =>
  ({ ...item("Sample term sheet.docx", DOCX), previewText }) as DataRoomApiItem;

it("shows the extracted text for a file the browser cannot show, instead of the icon", () => {
  const view = render(docx("Term sheet\n\nExample Co invests."));
  expect(view.querySelector("pre")?.textContent).toBe("Term sheet\n\nExample Co invests.");
  expect(view.querySelector("svg")).toBeNull();
});

it("keeps the file icon when an unshowable file has no extracted text", () => {
  const view = render(docx(null));
  expect(view.querySelector("pre")).toBeNull();
  expect(view.querySelector("svg")).not.toBeNull();
});

it("masks amounts in extracted text while amounts are hidden", () => {
  setHideAmounts(true);
  const view = render(docx("Investment: $1,250,000.00"));
  expect(view.querySelector("pre")?.textContent).toBe("Investment: $•••");
});

it("shows the extracted text when a showable file failed to load", () => {
  const pdf = { ...item("agreement.pdf", "application/pdf"), previewText: "Opening clause" };
  const view = render(pdf, "", true);
  expect(view.querySelector("pre")?.textContent).toBe("Opening clause");
});

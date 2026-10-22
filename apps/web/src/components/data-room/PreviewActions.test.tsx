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

import { FileViewer } from "./PreviewActions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item = (name: string, mimeType: string) =>
  ({ id: "i1", name, mimeType, size: 100 }) as DataRoomApiItem;
let container: HTMLDivElement | undefined;

afterEach(() => {
  container?.remove();
  container = undefined;
});

function render(node: DataRoomApiItem) {
  container = document.createElement("div");
  document.body.append(container);
  act(() =>
    createRoot(container as HTMLDivElement).render(
      <FileViewer item={node} file={{ url: "blob:file", failed: false }} />,
    ),
  );
  return container;
}

it("hides the browser PDF toolbar so only the app's Open and Download show", () => {
  const frame = render(item("agreement.pdf", "application/pdf")).querySelector("iframe");
  expect(frame?.getAttribute("src")).toBe("blob:file#toolbar=0");
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

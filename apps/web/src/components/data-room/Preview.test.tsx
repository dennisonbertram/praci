// @vitest-environment jsdom

import type { DataRoomApiItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const imageUrl = vi.hoisted(() => vi.fn());
vi.mock("../../lib/data-room", async (original) => ({
  ...(await original<typeof import("../../lib/data-room")>()),
  dataRoomImageUrl: imageUrl,
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { Preview } from "./Preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const receipt = {
  id: "r1",
  name: "receipt.png",
  mimeType: "image/png",
  size: 100,
  folderId: null,
  source: "upload",
  status: "ready",
  error: null,
  facets: {
    docType: null,
    docDate: null,
    parties: [],
    amountCents: null,
    currency: null,
    tags: [],
    summary: null,
  },
  createdAt: "2026-10-01T00:00:00.000Z",
} as DataRoomApiItem;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  imageUrl.mockResolvedValue("blob:receipt");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setHideAmounts(false);
  vi.clearAllMocks();
});

const render = () =>
  act(async () => {
    root.render(
      <Preview item={receipt} folderPath="" onAction={() => undefined} onClose={() => undefined} />,
    );
  });

it("shows the picture of an image item", async () => {
  await render();
  expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:receipt");
});

it("replaces the picture with a note, and never fetches it, while amounts are hidden", async () => {
  setHideAmounts(true);
  await render();
  expect(container.querySelector("img")).toBeNull();
  expect(imageUrl).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Image hidden while amounts are hidden");
  await act(async () => setHideAmounts(false));
  expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:receipt");
});

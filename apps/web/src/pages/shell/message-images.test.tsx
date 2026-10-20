// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../../lib/rpc", () => ({ rpc: { artifacts: { get: vi.fn() } } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { rpc } from "../../lib/rpc";
import { ArtifactImageGrid } from "./message-cards";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const image = (id: string, extra: object = {}) => ({
  kind: "image" as const,
  artifactId: id,
  mimeType: "image/png",
  name: `${id}.png`,
  ...extra,
});

async function render(images: ReturnType<typeof image>[]) {
  const el = document.createElement("div");
  document.body.append(el);
  await act(async () =>
    createRoot(el).render(<ArtifactImageGrid target={{ botId: "bot" }} images={images} />),
  );
  await act(async () => undefined);
  return el;
}

beforeEach(() => {
  vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });
  vi.mocked(rpc.artifacts.get).mockResolvedValue({
    contentBase64: "AA==",
    mimeType: "image/png",
  } as never);
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

it("shows a single image with its alt text and caption", async () => {
  const el = await render([image("one", { alt: "Revenue chart", caption: "Q3" })]);
  expect(el.querySelector("img")?.getAttribute("alt")).toBe("Revenue chart");
  expect(el.textContent).toContain("Q3");
  expect(el.querySelector(".grid")).toBeNull();
});

it("puts several images in a grid", async () => {
  const el = await render([image("a"), image("b"), image("c")]);
  expect(el.querySelector(".grid")).not.toBeNull();
  expect(el.querySelectorAll("img")).toHaveLength(3);
});

it("shows a skeleton while loading", async () => {
  vi.mocked(rpc.artifacts.get).mockReturnValue(new Promise(() => undefined));
  const el = await render([image("slow")]);
  expect(el.querySelector("[data-testid=image-skeleton]")).not.toBeNull();
});

it("falls back to the file name when the image cannot be fetched", async () => {
  vi.mocked(rpc.artifacts.get).mockRejectedValue(new Error("gone"));
  const el = await render([image("lost", { alt: "A lost picture" })]);
  expect(el.querySelector("img")).toBeNull();
  expect(el.textContent).toContain("lost.png");
  expect(el.querySelector("[role=img]")?.getAttribute("aria-label")).toBe("A lost picture");
});

it("opens the image full size on click", async () => {
  const el = await render([image("big")]);
  await act(async () => el.querySelector("button")?.click());
  expect(document.body.querySelectorAll("img").length).toBe(2);
  expect(document.body.querySelector("[aria-label='Close image preview']")).not.toBeNull();
});

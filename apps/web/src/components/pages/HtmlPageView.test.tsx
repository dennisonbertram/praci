// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  data: vi.fn(),
  refresh: vi.fn(),
  sources: vi.fn(),
  viewer: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    pages: { get: mocks.get, data: mocks.data, refresh: mocks.refresh, sources: mocks.sources },
  },
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../SandboxedHtmlViewer", () => ({
  SandboxedHtmlViewer: (props: { html: string; data?: unknown }) => {
    mocks.viewer(props);
    return null;
  },
}));

import { HtmlPageView } from "./HtmlPageView";

beforeEach(() => vi.clearAllMocks());

const page = (revision: number) => ({
  id: "p1",
  botId: "b",
  title: "T",
  kind: "html",
  content: `r${revision}`,
  revision,
});
const data = (revision: number) => ({
  kind: "html",
  pageId: "p1",
  revision,
  sources: { A: { status: "ok", rev: revision } },
});

it("gives the frame data only for the page revision it shows", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.sources.mockResolvedValue([]);
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (changeTick: number) =>
    act(async () => {
      root.render(
        <HtmlPageView
          botId="b"
          pageId="p1"
          title="T"
          changeTick={changeTick}
          dataTick={0}
          refreshTick={0}
        />,
      );
    });
  mocks.get.mockResolvedValue(page(1));
  mocks.data.mockResolvedValue(data(1));
  await show(0);
  expect(mocks.viewer.mock.lastCall?.[0]).toMatchObject({ html: "r1", data: data(1).sources });

  // The page moved to revision 2 but the data fetched is still revision 1: no data, never the old one.
  mocks.viewer.mockClear();
  mocks.get.mockResolvedValue(page(2));
  mocks.data.mockResolvedValue(data(1));
  await show(1);
  expect(
    mocks.viewer.mock.calls.every(([props]) => props.html !== "r2" || props.data === undefined),
  ).toBe(true);
  expect(mocks.viewer.mock.lastCall?.[0]).toMatchObject({ html: "r2", data: undefined });

  // Data for another page is refused too.
  mocks.data.mockResolvedValue({ ...data(2), pageId: "other" });
  await show(2);
  expect(mocks.viewer.mock.lastCall?.[0].data).toBeUndefined();

  mocks.data.mockResolvedValue(data(2));
  await show(3);
  expect(mocks.viewer.mock.lastCall?.[0]).toMatchObject({ html: "r2", data: data(2).sources });
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("shows a retry when the page cannot load, then renders it after retry", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(page(1));
  mocks.data.mockResolvedValue(data(1));
  mocks.sources.mockResolvedValue([]);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <HtmlPageView botId="b" pageId="p1" title="T" changeTick={0} dataTick={0} refreshTick={0} />,
    );
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not load the page.",
  );
  const retry = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Retry",
  );
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  expect(mocks.get).toHaveBeenCalledTimes(2);
  expect(mocks.viewer.mock.lastCall?.[0]).toMatchObject({ html: "r1" });
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("keeps rendering the page and stays silent when data fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockResolvedValue(page(1));
  mocks.data.mockRejectedValue(new Error("offline"));
  mocks.sources.mockResolvedValue([]);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <HtmlPageView botId="b" pageId="p1" title="T" changeTick={0} dataTick={0} refreshTick={0} />,
    );
  });
  expect(mocks.viewer.mock.lastCall?.[0]).toMatchObject({ html: "r1", data: undefined });
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("still gives the frame its data when the sources lookup fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockResolvedValue(page(1));
  mocks.data.mockResolvedValue(data(1));
  mocks.sources.mockRejectedValue(new Error("offline"));
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <HtmlPageView botId="b" pageId="p1" title="T" changeTick={0} dataTick={0} refreshTick={0} />,
    );
  });
  expect(mocks.viewer.mock.lastCall?.[0]).toMatchObject({ html: "r1", data: data(1).sources });
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("asks for a failed refresh again on the next update", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockResolvedValue(page(1));
  mocks.data.mockResolvedValue(data(1));
  mocks.sources.mockResolvedValue([]);
  mocks.refresh.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(data(1));
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (refreshTick: number, dataTick: number) =>
    act(async () => {
      root.render(
        <HtmlPageView
          botId="b"
          pageId="p1"
          title="T"
          changeTick={0}
          dataTick={dataTick}
          refreshTick={refreshTick}
        />,
      );
    });
  await show(0, 0);
  await show(1, 0);
  await show(1, 1);
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("clears a page when the newest refresh says it was deleted", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get
    .mockResolvedValueOnce(page(1))
    .mockRejectedValueOnce(new ORPCError("NOT_FOUND", { message: "Page not found" }));
  mocks.data.mockResolvedValue(data(1));
  mocks.sources.mockResolvedValue([]);
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (refreshTick: number) =>
    act(async () => {
      root.render(
        <HtmlPageView
          botId="b"
          pageId="p1"
          title="T"
          changeTick={0}
          dataTick={0}
          refreshTick={refreshTick}
        />,
      );
    });
  await show(0);
  await show(1);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not load the page.",
  );
  expect(container.querySelector("button")?.textContent).toBe("Retry");
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

it("keeps the page when its refresh fails transiently", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.get.mockResolvedValueOnce(page(1)).mockRejectedValueOnce(new Error("offline"));
  mocks.data.mockResolvedValue(data(1));
  mocks.sources.mockResolvedValue([]);
  const container = document.createElement("div");
  const root = createRoot(container);
  const show = (refreshTick: number) =>
    act(async () => {
      root.render(
        <HtmlPageView
          botId="b"
          pageId="p1"
          title="T"
          changeTick={0}
          dataTick={0}
          refreshTick={refreshTick}
        />,
      );
    });
  await show(0);
  await show(1);
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

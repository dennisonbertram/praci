// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listSpace: vi.fn(),
  listVersions: vi.fn(() => new Promise(() => {})),
  getById: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { artifacts: api } }));
vi.mock("../lib/bootstrap", () => ({
  takeInitialBootstrap: vi.fn().mockResolvedValue({ bots: [] }),
}));
vi.mock("../lib/artifact-open", () => ({
  decodeArtifactBase64: vi.fn(),
  downloadArtifactBytes: vi.fn(),
}));
vi.mock("../lib/relative-time", () => ({ formatRelativeTime: () => "just now" }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => text + part + String(values[index] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import { ArtifactsPage } from "./Artifacts";

function artifact(name: string, id: string, createdAt = new Date().toISOString()) {
  return {
    id,
    botId: null,
    groupId: null,
    runId: null,
    name,
    description: null,
    mimeType: "text/markdown",
    size: 128,
    version: 1,
    createdAt,
    versionCount: 1,
  };
}

function typeSearch(container: HTMLElement, value: string) {
  const input = container.querySelector("input[type='search']");
  if (!(input instanceof HTMLInputElement)) throw new Error("missing search input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderArtifacts(path = "/app/artifacts") {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/artifacts" element={<ArtifactsPage />} />
          <Route path="/app/artifacts/:artifactId" element={<ArtifactsPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

it("opens the Artifacts screen and lists what listSpace returns", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Q3 Content Calendar", "artifact-1")],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    expect(page.container.textContent).toContain("Artifacts");
    expect(page.container.querySelectorAll("h1")).toHaveLength(1);
    expect(page.container.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
    expect(page.container.textContent).toContain("Q3 Content Calendar");
    expect(page.container.querySelector("[data-testid='app-rail']")).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps loading later pages when search hides the current snapshot", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockImplementation(async (input: { cursor?: string }) => {
    if (!input.cursor) {
      return { items: [artifact("Alpha notes", "artifact-1")], nextCursor: "artifact-1" };
    }
    return { items: [artifact("Beta report", "artifact-2")], nextCursor: null };
  });
  const page = await renderArtifacts();
  try {
    expect(page.container.textContent).toContain("Alpha notes");
    await act(async () => {
      typeSearch(page.container, "Beta");
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(page.container.textContent).toContain("Beta report");
      });
    });
    expect(page.container.textContent).not.toContain("Alpha notes");
    expect(api.listSpace).toHaveBeenCalledWith(expect.objectContaining({ cursor: "artifact-1" }));
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("still offers Load more when filters match nothing on the loaded page", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let releaseSecondPage: (() => void) | undefined;
  const secondPage = new Promise<{
    items: ReturnType<typeof artifact>[];
    nextCursor: string | null;
  }>((resolve) => {
    releaseSecondPage = () =>
      resolve({ items: [artifact("Beta report", "artifact-2")], nextCursor: null });
  });
  api.listSpace.mockImplementation(async (input: { cursor?: string }) => {
    if (!input.cursor) {
      return { items: [artifact("Alpha notes", "artifact-1")], nextCursor: "artifact-1" };
    }
    return secondPage;
  });
  const page = await renderArtifacts();
  try {
    await act(async () => {
      typeSearch(page.container, "Beta");
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(page.container.textContent).toMatch(/Load more|Loading…/);
      });
    });
    expect(page.container.textContent).not.toContain("Beta report");
    await act(async () => {
      releaseSecondPage?.();
      await secondPage;
    });
    await act(async () => {
      await vi.waitFor(() => {
        expect(page.container.textContent).toContain("Beta report");
      });
    });
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("explains what artifacts are when the space has none", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({ items: [], nextCursor: null });
  const page = await renderArtifacts();
  try {
    expect(page.container.textContent).toContain("No artifacts yet");
    // Nothing to filter or switch yet, and Ask in the header already opens the chat.
    expect(page.container.textContent).not.toContain("Open chat");
    expect(page.container.querySelector("input[name='artifacts-search']")).toBeNull();
    expect(page.container.querySelector('[aria-label="Grid view"]')).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("scrolls to the open artifact when a later page brings its row in", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = function (this: Element) {
    if (this.getAttribute("aria-current") === "page") scrolled();
  };
  api.listSpace.mockImplementation(async (input: { cursor?: string }) =>
    input.cursor
      ? { items: [artifact("Beta report", "artifact-2")], nextCursor: null }
      : { items: [artifact("Alpha notes", "artifact-1")], nextCursor: "artifact-1" },
  );
  const page = await renderArtifacts("/app/artifacts/artifact-2");
  try {
    expect(scrolled).not.toHaveBeenCalled();
    const more = [...page.container.querySelectorAll("button")].find((b) =>
      /load more/i.test(b.textContent ?? ""),
    );
    await act(async () => more?.click());
    await vi.waitFor(() => expect(scrolled).toHaveBeenCalled());
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("gives an open artifact a way back to the list", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({ items: [artifact("Update", "artifact-1")], nextCursor: null });
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    const back = page.container.querySelector("a[aria-label='Back to artifacts']");
    expect(back?.getAttribute("href")).toBe("/app/artifacts");
    expect(page.container.textContent).not.toContain("Loading…Loading…");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps the search and filters to the list: phones hide them beside an open document, and maximizing removes them", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({ items: [artifact("Update", "artifact-1")], nextCursor: null });
  api.listVersions.mockRejectedValueOnce(new Error("no versions"));
  api.getById.mockResolvedValue({ ...artifact("Update", "artifact-1"), contentBase64: "" });
  vi.mocked((await import("../lib/artifact-open")).decodeArtifactBase64).mockReturnValue(
    new TextEncoder().encode("# Update"),
  );
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    const filters = () => page.container.querySelector("input[name='artifacts-search']");
    expect(filters()?.closest(".flex-wrap")?.className).toContain("hidden md:flex");
    const maximize = page.container.querySelector<HTMLButtonElement>(
      "button[aria-label='Maximize']",
    );
    await act(async () => maximize?.click());
    expect(filters()).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("shows artifacts as a table in list view and as cards in grid view, and remembers the choice", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.removeItem("rakazo:artifacts-view-mode");
  api.listSpace.mockResolvedValue({
    items: [artifact("Alpha notes", "artifact-1"), artifact("Beta report", "artifact-2")],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    const button = (label: string) =>
      page.container.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`);
    expect(page.container.querySelector("table")).toBeNull();
    expect(button("Grid view")?.getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("List view")?.click());
    expect(page.container.querySelectorAll("[data-testid='artifact-row']")).toHaveLength(2);
    const headings = [...page.container.querySelectorAll("th")].map((th) => th.textContent);
    expect(headings).toEqual(expect.arrayContaining(["Name", "Added"]));
    expect(headings).not.toContain("Bot");
    expect(headings).not.toContain("Size");
    expect(page.container.querySelector("tr a")?.getAttribute("href")).toBe(
      "/app/artifacts/artifact-1",
    );
    // No size anywhere: "128 bytes" means nothing to a founder.
    expect(page.container.textContent).not.toMatch(/bytes|\b128 B\b/);
    expect(window.localStorage.getItem("rakazo:artifacts-view-mode")).toBe("list");
    await act(async () => button("Grid view")?.click());
    expect(page.container.querySelector("table")).toBeNull();
    expect(page.container.textContent).toContain("Beta report");
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

function button(container: HTMLElement, text: string) {
  return [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
}

it("keeps a filtered-out list recoverable", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Alpha notes", "artifact-1")],
    nextCursor: null,
  });
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    await act(async () => typeSearch(page.container, "zzzz"));
    expect(page.container.textContent).toContain("No artifacts match these filters.");
    // The selected artifact is filtered out, so its preview is closed.
    expect(page.container.textContent).not.toContain("Back to artifacts");
    await act(async () => button(page.container, "Clear filters")?.click());
    expect(page.container.textContent).toContain("Alpha notes");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("shows delete on touch for card and row buttons", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Alpha notes", "artifact-1")],
    nextCursor: null,
  });
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    const del = page.container.querySelector("button[aria-label^='Delete']");
    expect(del?.className).toContain("pointer-coarse:opacity-100");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("offers only bots that own artifacts and shows the title without its extension", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const { takeInitialBootstrap } = await import("../lib/bootstrap");
  const bot = (id: string, name: string) => ({ id, name, color: "", status: "idle" });
  vi.mocked(takeInitialBootstrap).mockResolvedValueOnce({
    bots: [bot("b1", "Chief"), bot("b2", "Scribe"), bot("b3", "Idle bot")],
  } as never);
  api.listSpace.mockResolvedValue({
    items: [
      { ...artifact("Board Deck.md", "a1"), botId: "b1" },
      { ...artifact("Notes.csv", "a2"), botId: "b2" },
    ],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    await act(async () => button(page.container, "Bot")?.click());
    const options = [...document.querySelectorAll("[role=menuitemradio]")];
    expect(options.map((o) => o.textContent)).toEqual(["Chief", "Scribe"]);
    expect(page.container.textContent).toContain("Board Deck");
    expect(page.container.textContent).not.toContain("Board Deck.md");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("labels cards Doc and Sheet and gives a sheet its own icon", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Memo.md", "a1"), { ...artifact("Burn.csv", "a2"), mimeType: "text/csv" }],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    const cards = [...page.container.querySelectorAll("a[href^='/app/artifacts/']")];
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining("Doc"),
      expect.stringContaining("Sheet"),
    ]);
    expect(page.container.textContent).not.toMatch(/\b(MD|CSV)\b/);
    expect(cards[0]?.querySelector("svg path")).not.toBeNull();
    expect(cards[1]?.querySelector("svg rect")).not.toBeNull();
  } finally {
    await page.cleanup();
  }
});

it("offers Ask Chief in the header when Chief is available", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({ items: [artifact("Q3 Plan", "artifact-1")], nextCursor: null });
  const ask = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/app/artifacts"]}>
          <ArtifactsPage onAskAgent={ask} />
        </MemoryRouter>,
      ),
    );
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Ask");
    expect(button?.closest("[data-page-header]")).toBeTruthy();
    await act(async () => button?.click());
    expect(ask).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("names the delete button after the title, without the file extension", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Fundraising Plan.md", "artifact-1")],
    nextCursor: null,
  });
  const page = await renderArtifacts("/app/artifacts");
  try {
    const del = page.container.querySelector("button[aria-label^='Delete']");
    expect(del?.getAttribute("aria-label")).toBe("Delete Fundraising Plan");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listSpace: vi.fn(),
  listVersions: vi.fn(() => new Promise(() => {})),
  getById: vi.fn(),
  create: vi.fn(),
}));
const shares = vi.hoisted(() => ({
  get: vi.fn(async () => null as unknown),
  create: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { artifacts: api, artifactShares: shares } }));
vi.mock("../lib/artifact-open", () => ({
  bytesToBase64: vi.fn(),
  decodeArtifactBase64: vi.fn(),
  openArtifactBytes: vi.fn(),
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

i18n.loadAndActivate({ locale: "en", messages: {} });

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

function Where() {
  const { search } = useLocation();
  return <output data-testid="where">{search}</output>;
}

async function renderArtifacts(path = "/app/artifacts", bots: never[] = []) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/app/artifacts" element={<ArtifactsPage bots={bots} />} />
          <Route path="/app/artifacts/:artifactId" element={<ArtifactsPage bots={bots} />} />
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

it("offers Try again when a search fails after the list loaded", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace.mockImplementation(async (input: { q?: string }) => {
    if (input.q) throw new Error("offline");
    return { items: [artifact("Alpha notes", "artifact-1")], nextCursor: null };
  });
  const page = await renderArtifacts();
  try {
    await vi.waitFor(() => expect(page.container.textContent).toContain("Alpha notes"));
    await act(async () => {
      typeSearch(page.container, "Alpha");
    });
    // The failed search replaces the old rows with its error and a way to retry.
    await vi.waitFor(() => {
      expect(button(page.container, "Try again")).toBeDefined();
    });
    expect(page.container.textContent).not.toContain("Alpha notes");
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

it("keeps loading instead of saying nothing matches while a search is pending", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace.mockImplementation((input: { q?: string }) =>
    input.q
      ? new Promise(() => undefined)
      : Promise.resolve({ items: [artifact("Alpha notes", "artifact-1")], nextCursor: null }),
  );
  const page = await renderArtifacts();
  try {
    await vi.waitFor(() => expect(page.container.textContent).toContain("Alpha notes"));
    await act(async () => {
      typeSearch(page.container, "Zeta");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(api.listSpace).toHaveBeenCalledWith(expect.objectContaining({ q: "Zeta" }));
    expect(page.container.textContent).not.toContain("No artifacts match");
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

it("searches every artifact on the server and pages with the same query", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace.mockImplementation(async (input: { cursor?: string }) => {
    if (!input.cursor) {
      return { items: [artifact("Beta plan", "artifact-1")], nextCursor: "artifact-1" };
    }
    return { items: [artifact("Beta report", "artifact-2")], nextCursor: null };
  });
  const page = await renderArtifacts();
  try {
    await act(async () => {
      typeSearch(page.container, "Beta");
    });
    // The query reaches the server, so matches on later pages are found without paging through.
    await vi.waitFor(() => {
      expect(api.listSpace).toHaveBeenCalledWith(expect.objectContaining({ q: "Beta" }));
    });
    expect(api.listSpace.mock.calls.some(([input]) => input.q === "Beta" && !input.cursor)).toBe(
      true,
    );
    await vi.waitFor(() => {
      expect(page.container.textContent).toContain("Beta plan");
    });
    const more = [...page.container.querySelectorAll("button")].find((b) =>
      /load more/i.test(b.textContent ?? ""),
    );
    await act(async () => more?.click());
    await vi.waitFor(() => {
      expect(page.container.textContent).toContain("Beta report");
    });
    expect(api.listSpace).toHaveBeenCalledWith(
      expect.objectContaining({ q: "Beta", cursor: "artifact-1" }),
    );
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

it("keeps loading later pages when a date filter hides the current snapshot", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockImplementation(async (input: { cursor?: string }) => {
    if (!input.cursor) {
      return {
        items: [artifact("Old notes", "artifact-1", "2020-01-01T00:00:00.000Z")],
        nextCursor: "artifact-1",
      };
    }
    return { items: [artifact("Beta report", "artifact-2")], nextCursor: null };
  });
  const page = await renderArtifacts("/app/artifacts?added=today");
  try {
    expect(page.container.textContent).not.toContain("Old notes");
    await vi.waitFor(() => {
      expect(page.container.textContent).toContain("Beta report");
    });
    expect(api.listSpace).toHaveBeenCalledWith(expect.objectContaining({ cursor: "artifact-1" }));
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("offers Try again when artifacts fail to load and shows a failed Load more", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace
    .mockRejectedValueOnce(new Error(""))
    .mockResolvedValueOnce({
      items: [artifact("Alpha notes", "artifact-1")],
      nextCursor: "artifact-1",
    })
    .mockRejectedValueOnce(new Error(""));
  const page = await renderArtifacts();
  try {
    await vi.waitFor(() => {
      expect(page.container.textContent).toContain("Could not load artifacts.");
    });
    await act(async () => {
      button(page.container, "Try again")?.click();
    });
    await vi.waitFor(() => {
      expect(page.container.textContent).toContain("Alpha notes");
    });
    await act(async () => {
      button(page.container, "Load more")?.click();
    });
    // The failed page keeps the button so the same page can be tried again.
    await vi.waitFor(() => {
      expect(page.container.textContent).toContain("Could not load artifacts.");
    });
    expect(button(page.container, "Load more")?.hasAttribute("disabled")).toBe(false);
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
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
    // Wait for the settled query so the click below is not dropped by its reload.
    await vi.waitFor(() => {
      expect(api.listSpace.mock.calls.some(([input]) => input.q === "Beta")).toBe(true);
    });
    await vi.waitFor(() => {
      expect(page.container.textContent).toMatch(/Load more|Loading…/);
    });
    expect(page.container.textContent).not.toContain("Beta report");
    // Search runs on the server, so an empty page offers Load more rather than paging on its own.
    await act(async () => {
      const more = [...page.container.querySelectorAll("button")].find((b) =>
        /load more/i.test(b.textContent ?? ""),
      );
      more?.click();
    });
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

it("puts a grid card's version badge on the title line so versioned cards are no taller", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.removeItem("rakazo:artifacts-view-mode");
  api.listSpace.mockResolvedValue({
    items: [{ ...artifact("Alpha notes", "artifact-1"), version: 2, versionCount: 2 }],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    const badge = [...page.container.querySelectorAll("a span")].find(
      (el) => el.textContent === "v2",
    );
    expect(badge?.parentElement?.textContent).toContain("Alpha notes");
  } finally {
    await page.cleanup();
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
    // Narrow panes hide the mid columns, so the row's delete button must not sit in a hidden cell.
    const del = page.container.querySelector("tr button[aria-label^='Delete']");
    expect(del?.closest("td")?.className).not.toMatch(/(^| )hidden/);
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
    // The page answers once the server has, not while the search is still on its way.
    await vi.waitFor(() => {
      expect(page.container.textContent).toContain("No artifacts match these filters.");
    });
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
  const bot = (id: string, name: string) => ({ id, name, color: "", status: "idle" });
  const bots = [bot("b1", "Chief"), bot("b2", "Scribe"), bot("b3", "Idle bot")] as never[];
  api.listSpace.mockResolvedValue({
    items: [
      { ...artifact("Board Deck.md", "a1"), botId: "b1" },
      { ...artifact("Notes.csv", "a2"), botId: "b2" },
    ],
    nextCursor: null,
  });
  const page = await renderArtifacts("/app/artifacts", bots);
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

it("shows cards without a file extension and gives a sheet its own icon", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Memo.md", "a1"), { ...artifact("Burn.csv", "a2"), mimeType: "text/csv" }],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    const cards = [...page.container.querySelectorAll("a[href^='/app/artifacts/']")];
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining("Memo"),
      expect.stringContaining("Burn"),
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
    // The confirm dialog names it the same way, not by the file name.
    await act(async () => (del as HTMLElement).click());
    const title = document.querySelector("[data-slot=alert-dialog-title]")?.textContent;
    expect(title).toBe('Delete "Fundraising Plan"?');
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("tells the owner that deleting also stops the share link, only when there is one", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({ items: [artifact("Plan.md", "artifact-1")], nextCursor: null });
  shares.get.mockResolvedValueOnce({ artifactId: "artifact-1", version: 1, expiresAt: "x" });
  const page = await renderArtifacts("/app/artifacts");
  try {
    const del = page.container.querySelector("button[aria-label^='Delete']");
    await act(async () => (del as HTMLElement).click());
    expect(document.querySelector("[data-slot=alert-dialog-description]")?.textContent).toContain(
      "This also stops its link.",
    );
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps the view switch in the split view and returns to the full list when it is used", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.removeItem("rakazo:artifacts-view-mode");
  api.listSpace.mockResolvedValue({
    items: [artifact("Alpha notes", "artifact-1"), artifact("Beta report", "artifact-2")],
    nextCursor: null,
  });
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    const list = page.container.querySelector<HTMLButtonElement>("button[aria-label='List view']");
    expect(list).not.toBeNull();
    await act(async () => list?.click());
    expect(page.container.querySelector("table")).not.toBeNull();
    expect(page.container.querySelector("[data-testid='artifact-row']")).not.toBeNull();
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

it("clears the date filter when the palette applies a search", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Old report", "artifact-1", "2020-01-01T00:00:00.000Z")],
    nextCursor: null,
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let go: (to: string) => void = () => {};
  function Nav() {
    go = useNavigate();
    return null;
  }
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/artifacts"]}>
        <Nav />
        <Routes>
          <Route path="/app/artifacts" element={<ArtifactsPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  try {
    const press = async (el: Element | null | undefined) =>
      act(async () => {
        el?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
        el?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        (el as HTMLElement | null | undefined)?.click();
      });
    await press(button(container, "Added"));
    await press(
      [...document.body.querySelectorAll<HTMLElement>("[role^=menuitem]")].find((el) =>
        el.textContent?.includes("Today"),
      ),
    );
    expect(container.textContent).not.toContain("Old report");
    await act(async () => go("/app/artifacts?q=report"));
    expect(container.textContent).toContain("Old report");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

const names = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-testid='artifact-row'] a")].map((a) => a.textContent);

it("sorts the table by header, keeps the sort in the URL, and shows newest first by default", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace.mockResolvedValue({
    items: [
      artifact("Bravo", "a", "2026-01-03T00:00:00.000Z"),
      artifact("Alpha", "b", "2026-01-02T00:00:00.000Z"),
      { ...artifact("Charlie", "c", "2026-01-01T00:00:00.000Z"), mimeType: "text/html" },
    ],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    const head = (name: string) =>
      [...page.container.querySelectorAll<HTMLElement>("th button")].find(
        (b) => b.textContent === name,
      ) as HTMLElement;
    const where = () => page.container.querySelector("[data-testid='where']")?.textContent;
    expect(names(page.container)).toEqual(["Bravo", "Alpha", "Charlie"]);
    await act(async () => head("Name").click());
    expect(names(page.container)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(where()).toBe("?sort=name&dir=asc");
    await act(async () => head("Name").click());
    expect(names(page.container)).toEqual(["Charlie", "Bravo", "Alpha"]);
    await act(async () => head("Type").click());
    expect(names(page.container)[0]).toBe("Bravo");
    expect(names(page.container)[2]).toBe("Charlie");
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

it("reads search, type and date filters from the URL and writes them back", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace.mockResolvedValue({
    items: [
      artifact("Bravo", "a"),
      { ...artifact("Charlie", "c"), mimeType: "text/html" },
      artifact("Old doc", "d", "2020-01-01T00:00:00.000Z"),
    ],
    nextCursor: null,
  });
  const page = await renderArtifacts("/app/artifacts?type=page");
  try {
    expect(names(page.container)).toEqual(["Charlie"]);
    expect(button(page.container, "Type: Page")).toBeDefined();
    await act(async () =>
      page.container
        .querySelector<HTMLButtonElement>("button[aria-label='Remove filter Type']")
        ?.click(),
    );
    expect(names(page.container)).toHaveLength(3);
    await act(async () => typeSearch(page.container, "bravo"));
    expect(page.container.querySelector("[data-testid='where']")?.textContent).toBe("?q=bravo");
    expect(names(page.container)).toEqual(["Bravo"]);
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

it("keeps the filters in the URL when an artifact opens", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace.mockResolvedValue({ items: [artifact("Bravo", "a")], nextCursor: null });
  const page = await renderArtifacts("/app/artifacts?q=bravo&added=today");
  try {
    await act(async () => page.container.querySelector<HTMLAnchorElement>("tr a")?.click());
    expect(page.container.querySelector("[data-testid='where']")?.textContent).toBe(
      "?q=bravo&added=today",
    );
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

async function openSharedHtml(expiresAt: string) {
  shares.get.mockReset();
  api.listSpace.mockResolvedValue({
    items: [artifact("Page.html", "artifact-1")],
    nextCursor: null,
  });
  api.listVersions.mockRejectedValueOnce(new Error("no versions"));
  api.getById.mockResolvedValue({
    ...artifact("Page.html", "artifact-1"),
    mimeType: "text/html",
    contentBase64: "",
  });
  vi.mocked((await import("../lib/artifact-open")).decodeArtifactBase64).mockReturnValue(
    new TextEncoder().encode("<p>hi</p>"),
  );
  shares.get.mockResolvedValueOnce({ artifactId: "artifact-1", version: 1, expiresAt });
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  const share = [...page.container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Share"),
  );
  await act(async () => share?.click());
  return page;
}
const dialogButton = (name: string) =>
  [...document.querySelectorAll("[data-slot=dialog-content] button")].find(
    (b) => b.textContent === name,
  ) as HTMLButtonElement | undefined;

async function openSharePageWithFailedLoad() {
  shares.get.mockReset();
  shares.create.mockReset();
  api.listVersions.mockReset();
  api.getById.mockReset();
  api.listSpace.mockReset();
  api.create.mockReset();
  api.listSpace.mockResolvedValue({
    items: [artifact("Page.html", "artifact-1")],
    nextCursor: null,
  });
  api.listVersions.mockRejectedValueOnce(new Error("no versions"));
  api.getById.mockResolvedValue({
    ...artifact("Page.html", "artifact-1"),
    mimeType: "text/html",
    contentBase64: "",
  });
  vi.mocked((await import("../lib/artifact-open")).decodeArtifactBase64).mockReturnValue(
    new TextEncoder().encode("<p>hi</p>"),
  );
  shares.get.mockRejectedValueOnce(new Error("share load failed"));
  return renderArtifacts("/app/artifacts/artifact-1");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function openSharePageWithPendingLoad(load: Promise<unknown>) {
  shares.get.mockReset();
  shares.create.mockReset();
  api.listVersions.mockRejectedValueOnce(new Error("no versions"));
  api.listSpace.mockResolvedValue({
    items: [artifact("Page.html", "artifact-1")],
    nextCursor: null,
  });
  api.getById.mockResolvedValue({
    ...artifact("Page.html", "artifact-1"),
    mimeType: "text/html",
    contentBase64: "",
  });
  vi.mocked((await import("../lib/artifact-open")).decodeArtifactBase64).mockReturnValue(
    new TextEncoder().encode("<p>hi</p>"),
  );
  shares.get.mockReturnValue(load);
  return renderArtifacts("/app/artifacts/artifact-1");
}

it("disables Share while the initial share status is loading", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const pending = deferred<unknown>();
  const page = await openSharePageWithPendingLoad(pending.promise);
  try {
    expect(
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Share"]')?.disabled,
    ).toBe(true);
  } finally {
    pending.resolve(null);
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("does not replace a link when its failed share load is still unresolved", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openSharePageWithFailedLoad();
  try {
    shares.get.mockResolvedValueOnce({ artifactId: "other-version", version: 1 });
    await act(async () =>
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Share"]')?.click(),
    );
    expect(shares.get).toHaveBeenCalledTimes(2);
    expect(shares.create).not.toHaveBeenCalled();
    expect(
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Update link"]'),
    ).not.toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("ignores a second click while re-checking share status", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openSharePageWithFailedLoad();
  const retry = deferred<unknown>();
  try {
    shares.get.mockReturnValueOnce(retry.promise);
    shares.create.mockResolvedValueOnce({
      url: "https://app.example.test/s#token",
      share: { artifactId: "artifact-1", version: 1 },
    });
    const button = page.container.querySelector<HTMLButtonElement>('button[aria-label="Share"]');
    await act(async () => {
      button?.click();
      button?.click();
    });
    expect(shares.get).toHaveBeenCalledTimes(2);
    expect(shares.create).not.toHaveBeenCalled();
    await act(async () => retry.resolve(null));
    expect(shares.create).toHaveBeenCalledTimes(1);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("shows an alert and creates nothing when the share status re-check fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openSharePageWithFailedLoad();
  try {
    shares.get.mockRejectedValueOnce(new Error("retry failed"));
    await act(async () =>
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Share"]')?.click(),
    );
    expect(page.container.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(shares.create).not.toHaveBeenCalled();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("opens the dialog when the re-check finds a link for this version", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openSharePageWithFailedLoad();
  try {
    shares.get.mockResolvedValueOnce({ artifactId: "artifact-1", version: 1 });
    await act(async () =>
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Share"]')?.click(),
    );
    expect(document.querySelector("[data-slot=dialog-content]")).not.toBeNull();
    expect(shares.create).not.toHaveBeenCalled();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("replaces a link on another version when Update link is clicked after the retry", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openSharePageWithFailedLoad();
  try {
    shares.get.mockResolvedValueOnce({ artifactId: "other-version", version: 1 });
    shares.create.mockResolvedValueOnce({
      url: "https://app.example.test/s#token",
      share: { artifactId: "artifact-1", version: 1 },
    });
    await act(async () =>
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Share"]')?.click(),
    );
    expect(shares.create).not.toHaveBeenCalled();
    await act(async () =>
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Update link"]')?.click(),
    );
    expect(shares.create).toHaveBeenCalledTimes(1);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("retries a failed share load and creates a link only after confirming none exists", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openSharePageWithFailedLoad();
  try {
    shares.get.mockResolvedValueOnce(null);
    shares.create.mockResolvedValueOnce({
      url: "https://app.example.test/s#token",
      share: { artifactId: "artifact-1", version: 1 },
    });
    await act(async () =>
      page.container.querySelector<HTMLButtonElement>('button[aria-label="Share"]')?.click(),
    );
    expect(shares.get).toHaveBeenCalledTimes(2);
    expect(shares.create).toHaveBeenCalledTimes(1);
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("lets the owner replace a reopened share link and shows when it expires", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  shares.create.mockReset();
  shares.create.mockResolvedValueOnce({
    url: "https://app.example.test/s#new-token",
    share: { artifactId: "artifact-1", version: 1, expiresAt: "2030-03-15T12:00:00.000Z" },
  });
  const page = await openSharedHtml("2030-02-10T12:00:00.000Z");
  try {
    const dialog = () => document.querySelector("[data-slot=dialog-content]")?.textContent ?? "";
    expect(dialog()).toContain("Feb 10, 2030");
    expect(dialog()).toContain("Links are shown once. Replacing this one stops the old link.");
    await act(async () => dialogButton("Replace link")?.click());
    expect(shares.create).toHaveBeenCalledTimes(1);
    expect(shares.create).toHaveBeenCalledWith({ artifactId: "artifact-1" });
    expect(dialogButton("Copy")).toBeDefined();
    expect(
      document.querySelector<HTMLInputElement>("[data-slot=dialog-content] input")?.value,
    ).toBe("https://app.example.test/s#new-token");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("shows a failed replace inside the share dialog", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  shares.create.mockReset();
  shares.create.mockRejectedValueOnce(new Error("boom"));
  const page = await openSharedHtml("2030-02-10T12:00:00.000Z");
  try {
    await act(async () => dialogButton("Replace link")?.click());
    expect(
      document.querySelector("[data-slot=dialog-content] [role=alert]")?.textContent,
    ).toBeTruthy();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("names the icon-only Share and Download header buttons", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({
    items: [artifact("Page.html", "artifact-1")],
    nextCursor: null,
  });
  api.listVersions.mockRejectedValueOnce(new Error("no versions"));
  api.getById.mockResolvedValue({
    ...artifact("Page.html", "artifact-1"),
    mimeType: "text/html",
    contentBase64: "",
  });
  shares.get.mockResolvedValueOnce(null);
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    const labels = [...page.container.querySelectorAll("header button")].map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(labels).toContain("Share");
    expect(labels).toContain("Download");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("offers the sort control in list view without an open artifact", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.setItem("rakazo:artifacts-view-mode", "list");
  api.listSpace.mockResolvedValue({
    items: [artifact("Bravo", "a"), artifact("Alpha", "b")],
    nextCursor: null,
  });
  const page = await renderArtifacts();
  try {
    const sort = [...page.container.querySelectorAll("button")].find((b) =>
      /Sort: Added/.test(b.textContent ?? ""),
    );
    expect(sort).toBeDefined();
  } finally {
    await page.cleanup();
    window.localStorage.removeItem("rakazo:artifacts-view-mode");
    vi.unstubAllGlobals();
  }
});

it("shows the restored version on the list row after Restore this version", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const v1 = {
    id: "artifact-1",
    version: 1,
    name: "Alpha notes",
    createdAt: "2026-01-01T00:00:00Z",
  };
  const v2 = {
    id: "artifact-2",
    version: 2,
    name: "Alpha notes",
    createdAt: "2026-01-02T00:00:00Z",
  };
  const v3 = {
    id: "artifact-3",
    version: 3,
    name: "Alpha notes",
    createdAt: "2026-01-03T00:00:00Z",
  };
  api.listSpace.mockResolvedValue({
    items: [{ ...artifact("Alpha notes", "artifact-1"), version: 2, versionCount: 2 }],
    nextCursor: null,
  });
  api.listVersions.mockResolvedValueOnce([v2, v1]).mockResolvedValue([v3, v2, v1]);
  api.getById.mockImplementation(async ({ artifactId }: { artifactId: string }) => ({
    ...artifact("Alpha notes", artifactId, "2026-01-01T00:00:00Z"),
    version: artifactId === v1.id ? 1 : 2,
    contentBase64: "",
  }));
  api.create.mockResolvedValue({ ...artifact("Alpha notes", v3.id), version: 3 });
  vi.mocked((await import("../lib/artifact-open")).decodeArtifactBase64).mockReturnValue(
    new TextEncoder().encode("# Alpha"),
  );
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    const openRow = () => page.container.querySelector("aside a[aria-current='page']");
    expect(openRow()?.textContent).toContain("v2");
    const pick = page.container.querySelector<HTMLSelectElement>("select[aria-label='Version']");
    expect(pick).not.toBeNull();
    await act(async () => {
      pick!.value = v1.id;
      pick!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const restore = [...page.container.querySelectorAll("button")].find(
      (b) => b.textContent === "Restore this version",
    );
    await act(async () => restore?.click());
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(openRow()?.textContent).toContain("v3");
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

async function openRestorePage(refreshFails = false) {
  api.listVersions.mockReset();
  api.getById.mockReset();
  api.listSpace.mockReset();
  api.create.mockReset();
  const v1 = {
    id: "artifact-1",
    version: 1,
    name: "Alpha notes",
    createdAt: "2026-01-01T00:00:00Z",
  };
  const v2 = {
    id: "artifact-2",
    version: 2,
    name: "Alpha notes",
    createdAt: "2026-01-02T00:00:00Z",
  };
  api.listSpace.mockResolvedValue({
    items: [{ ...artifact("Alpha notes", "artifact-1"), version: 2, versionCount: 2 }],
    nextCursor: null,
  });
  if (refreshFails) {
    let calls = 0;
    api.listVersions.mockImplementation(() => {
      calls += 1;
      return calls === 1 ? Promise.resolve([v2, v1]) : Promise.reject(new Error("refresh failed"));
    });
  } else api.listVersions.mockResolvedValue([v2, v1]);
  api.getById.mockImplementation(async ({ artifactId }: { artifactId: string }) => ({
    ...artifact("Alpha notes", artifactId),
    version: artifactId === v1.id ? 1 : 2,
    contentBase64: "",
  }));
  vi.mocked((await import("../lib/artifact-open")).decodeArtifactBase64).mockReturnValue(
    new TextEncoder().encode("# Alpha"),
  );
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  const pick = page.container.querySelector<HTMLSelectElement>('select[aria-label="Version"]')!;
  await act(async () => {
    pick.value = v1.id;
    pick.dispatchEvent(new Event("change", { bubbles: true }));
  });
  return page;
}

it("shows restore failures and does not report the artifact restored", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openRestorePage();
  api.create.mockRejectedValueOnce(new Error("restore failed"));
  try {
    await act(async () =>
      [...page.container.querySelectorAll("button")]
        .find((b) => b.textContent === "Restore this version")
        ?.click(),
    );
    expect(page.container.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(page.container.querySelector("aside a[aria-current='page']")?.textContent).toContain(
      "v2",
    );
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

it("keeps the restored version selectable when refreshing versions fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const page = await openRestorePage(true);
  api.create.mockResolvedValueOnce({ ...artifact("Alpha notes", "artifact-3"), version: 3 });
  try {
    await act(async () =>
      [...page.container.querySelectorAll("button")]
        .find((b) => b.textContent === "Restore this version")
        ?.click(),
    );
    const pick = page.container.querySelector<HTMLSelectElement>('select[aria-label="Version"]');
    expect(pick?.value).toBe("artifact-3");
    expect(page.container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await page.cleanup();
    vi.unstubAllGlobals();
  }
});

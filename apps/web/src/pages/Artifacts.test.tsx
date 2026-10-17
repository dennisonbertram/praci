// @vitest-environment jsdom

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { act, cloneElement } from "react";
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
  const t = (parts: TemplateStringsArray) => parts.join("");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    AlertDialog: Container,
    AlertDialogAction: Container,
    AlertDialogCancel: Container,
    AlertDialogContent: Container,
    AlertDialogDescription: Container,
    AlertDialogFooter: Container,
    AlertDialogHeader: Container,
    AlertDialogTitle: Container,
    BotAvatar: () => <span />,
    Button: ({ render, ...props }: ComponentProps<"button"> & { render?: ReactElement }) =>
      render ? cloneElement(render, props as object) : <button {...props} />,
    Skeleton: () => <span />,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    parseBotAvatar: () => ({ color: undefined }),
    resolvePersonaColorDef: () => ({ hex: "#000000" }),
  };
});

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
    const filters = [...page.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Filters"),
    );
    expect(filters).toBeTruthy();
    await act(async () => {
      filters?.click();
    });
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
    const filters = [...page.container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Filters"),
    );
    await act(async () => {
      filters?.click();
    });
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
    const open = [...page.container.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("Open chat"),
    );
    expect(open?.getAttribute("href")).toBe("/app");
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

it("keeps Filters to the list: phones hide it beside an open document, and maximizing removes it", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.listSpace.mockResolvedValue({ items: [artifact("Update", "artifact-1")], nextCursor: null });
  api.listVersions.mockRejectedValueOnce(new Error("no versions"));
  api.getById.mockResolvedValue({ ...artifact("Update", "artifact-1"), contentBase64: "" });
  vi.mocked((await import("../lib/artifact-open")).decodeArtifactBase64).mockReturnValue(
    new TextEncoder().encode("# Update"),
  );
  const page = await renderArtifacts("/app/artifacts/artifact-1");
  try {
    const filters = () => page.container.querySelector("[data-testid='artifacts-filters']");
    expect(filters()?.className).toContain("hidden md:flex");
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

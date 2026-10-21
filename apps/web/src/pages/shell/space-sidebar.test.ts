// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
  msg: (parts: TemplateStringsArray) => parts[0] ?? "",
  plural: (value: number, forms: { one: string; other: string }) =>
    (value === 1 ? forms.one : forms.other).replace("#", String(value)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts[0] ?? "" }),
}));

import {
  activeSpaceFirst,
  commitSpaceRename,
  sidebarGroupsForSpaces,
  spaceHoldingChat,
} from "./space-sidebar";
import { SidebarFixture } from "./space-sidebar.stories";

function CurrentPath() {
  return createElement("output", { "data-testid": "current-path" }, useLocation().pathname);
}

function chat(id: string, name: string) {
  return {
    id,
    name,
    title: "",
    preview: "",
    pinned: false,
    sectionId: null as string | null,
    parentBotId: null,
  };
}

function space(
  id: string,
  name: string,
  options: { canRename?: boolean; canDelete?: boolean; bots?: ReturnType<typeof chat>[] } = {},
) {
  return {
    id,
    name,
    canRename: options.canRename ?? false,
    canDelete: options.canDelete ?? false,
    bots: options.bots ?? [chat(`${id}-bot`, "Chief")],
    groups: [],
    botSections: [],
  };
}

describe("sidebarGroupsForSpaces", () => {
  it("names the only space above its chats, beside its actions", () => {
    const [group] = sidebarGroupsForSpaces([space("space-1", "Personal", { canRename: true })], "");

    expect(group).toMatchObject({
      title: "Personal",
      spaceName: "Personal",
      canRenameSpace: true,
      canDeleteSpace: false,
      showLock: false,
    });
    expect(group?.bots).toHaveLength(1);
  });

  it("heads the only space with the given label and keeps its name", () => {
    const [group] = sidebarGroupsForSpaces(
      [space("space-1", "Personal", { canRename: true })],
      "",
      undefined,
      "Personnel",
    );
    expect(group).toMatchObject({ title: "Personnel", spaceName: "Personal", relabeled: true });
  });

  it("does not relabel a lone space whose name already matches the label", () => {
    const [group] = sidebarGroupsForSpaces(
      [space("space-1", "Personal")],
      "",
      undefined,
      "Personal",
    );
    expect(group).toMatchObject({ title: "Personal", spaceName: "Personal", relabeled: false });
  });

  it("keeps the Personnel heading above pinned agents, folders and the rest", () => {
    const pinned = { ...chat("b1", "Chief"), pinned: true };
    const filed = { ...chat("b2", "Ops"), sectionId: "s1" };
    const loose = chat("b3", "Helper");
    const only = {
      ...space("space-1", "Personal", { canRename: true, bots: [pinned, filed, loose] }),
      botSections: [
        { id: "s1", name: "Ops team", collapsed: true },
        { id: "s2", name: "Empty folder" },
      ],
    };
    const groups = sidebarGroupsForSpaces([only], "", undefined, "Personnel");

    expect(groups.map((g) => [g.kind, g.title])).toEqual([
      ["head", "Personnel"],
      ["pinned", "Pinned"],
      ["folder", "Ops team"],
      ["folder", "Empty folder"],
      ["root", null],
    ]);
    expect(groups[0]).toMatchObject({
      spaceName: "Personal",
      relabeled: true,
      canRenameSpace: true,
    });
    expect(groups.slice(1).every((g) => g.parentKey === groups[0]?.key)).toBe(true);
    expect(groups.map((g) => g.bots.map((item) => item.id))).toEqual([
      [],
      ["b1"],
      ["b2"],
      [],
      ["b3"],
    ]);
    expect(groups.map((g) => g.collapsed)).toEqual([false, false, true, false, false]);
  });

  it("heads a pinned-only single space with Personnel", () => {
    const only = space("space-1", "Personal", { bots: [{ ...chat("b1", "Chief"), pinned: true }] });
    const groups = sidebarGroupsForSpaces([only], "", undefined, "Personnel");
    expect(groups.map((g) => g.title)).toEqual(["Personnel", "Pinned", null]);
  });

  it("orders a folder's bots and groups by position, groups last until ordered", () => {
    const first = { ...chat("g1", "Team"), position: 0 };
    const second = { ...chat("b1", "Chief"), position: 3 };
    const unordered = { ...chat("g2", "Other"), position: null };
    const only = {
      ...space("space-1", "Personal", { bots: [second] }),
      groups: [unordered, first],
    };
    const [group] = sidebarGroupsForSpaces([only], "");
    expect(group?.bots.map((item) => item.id)).toEqual(["g1", "b1", "g2"]);
  });

  it("treats a bot in a deleted folder as unfiled and hides empty folders while searching", () => {
    const lost = { ...chat("b1", "Chief"), sectionId: "gone" };
    const only = {
      ...space("space-1", "Personal", { bots: [lost] }),
      botSections: [{ id: "s1", name: "Ops" }],
    };
    expect(sidebarGroupsForSpaces([only], "").map((g) => g.kind)).toEqual([
      "head",
      "folder",
      "root",
    ]);
    expect(sidebarGroupsForSpaces([only], "chief").map((g) => g.kind)).toEqual(["space"]);
  });

  it("still names each space once there is more than one", () => {
    const groups = sidebarGroupsForSpaces(
      [
        space("space-1", "Personal", { canRename: true }),
        space("space-2", "Support", { canRename: true, canDelete: true, bots: [] }),
      ],
      "",
      undefined,
      "Personnel",
    );

    expect(groups.map((group) => group.title)).toEqual(["Personal", "Support"]);
    expect(groups[0]).toMatchObject({ canRenameSpace: true, canDeleteSpace: false });
    expect(groups[1]).toMatchObject({
      canRenameSpace: true,
      canDeleteSpace: true,
      emptySpaceId: "space-2",
    });
  });

  it("marks the space being shown, including an empty one, only when several are listed", () => {
    const spaces = [space("space-1", "Personal"), space("space-2", "Empty", { bots: [] })];
    expect(sidebarGroupsForSpaces(spaces, "", "space-2").map((g) => g.current)).toEqual([
      false,
      true,
    ]);
    expect(sidebarGroupsForSpaces([space("space-1", "Personal")], "", "space-1")[0]?.current).toBe(
      false,
    );
  });

  it("hides space actions while a search removes every chat from the only space", () => {
    expect(
      sidebarGroupsForSpaces([space("space-1", "Personal", { canRename: true })], "missing"),
    ).toEqual([]);
  });
});

describe("commitSpaceRename", () => {
  it("applies the saved name when the following refresh fails", async () => {
    const rename = vi.fn(async () => undefined);
    const apply = vi.fn();
    const refresh = vi.fn(async () => {
      throw new Error("list failed");
    });

    await expect(commitSpaceRename({ rename, apply, refresh })).resolves.toBeUndefined();
    expect(rename).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not apply a name when the rename itself fails", async () => {
    const apply = vi.fn();
    const refresh = vi.fn(async () => undefined);

    await expect(
      commitSpaceRename({
        rename: async () => {
          throw new Error("Space deletion is already in progress");
        },
        apply,
        refresh,
      }),
    ).rejects.toThrow("Space deletion is already in progress");
    expect(apply).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("activeSpaceFirst", () => {
  it("puts the space on screen first and keeps the others in order", () => {
    const spaces = [space("a", "Northwind"), space("b", "Empty"), space("c", "Third")];
    expect(activeSpaceFirst(spaces, "b").map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(activeSpaceFirst(spaces, undefined).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("spaceHoldingChat", () => {
  const spaces = [
    { id: "s1", bots: [{ id: "b1" }], groups: [] },
    { id: "s2", bots: [{ id: "b2" }], groups: [{ id: "g2" }] },
  ];
  it("finds the other space that holds a bot or group, and nothing for an unknown id", () => {
    expect(spaceHoldingChat(spaces, "s1", "b2")).toBe("s2");
    expect(spaceHoldingChat(spaces, "s1", "g2")).toBe("s2");
    expect(spaceHoldingChat(spaces, "s1", "nope")).toBeNull();
  });
  it("ignores the current space, whose chats the page already checked", () => {
    expect(spaceHoldingChat(spaces, "s1", "b1")).toBeNull();
  });
});

it("shows Devin's needs-you count and opens its page", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const renderSidebar = (devinConnected: boolean) =>
    createElement(
      MemoryRouter,
      null,
      createElement(
        "div",
        null,
        createElement(SidebarFixture, {
          mode: "expanded",
          devinMode: true,
          devinConnected,
          devinNeedsYou: 2,
        }),
        createElement(CurrentPath),
      ),
    );
  try {
    await act(async () => {
      root.render(renderSidebar(false));
    });

    expect(container.querySelector('[data-testid="sidebar-devin"]')).toBeNull();
    const pageOptions = () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Page options"]');
    await act(async () => pageOptions()?.click());
    expect(document.body.textContent).not.toContain("Devin");
    await act(async () => pageOptions()?.click());

    await act(async () => root.render(renderSidebar(true)));
    await act(async () => pageOptions()?.click());
    expect(document.body.textContent).toContain("Devin");
    await act(async () => pageOptions()?.click());
    const link = container.querySelector<HTMLButtonElement>('[data-testid="sidebar-devin"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.getAttribute("aria-label")).toBe("Devin, 2 need you");
    expect(link?.querySelector('[data-testid="glance-value"]')?.textContent).toBe("2");

    await act(async () => {
      link?.click();
    });
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe("/app/devin");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("navigates to Integrations from the account menu", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            "div",
            null,
            createElement(SidebarFixture, { mode: "expanded" }),
            createElement(CurrentPath),
          ),
        ),
      );
    });

    const menuTrigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="user-menu-trigger"]',
    );
    await act(async () => menuTrigger?.click());
    const integrations = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="menu-integrations"]',
    );
    expect(integrations?.textContent).toContain("Integrations");

    await act(async () => integrations?.click());
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe(
      "/app/integrations",
    );
    expect(document.body.querySelector('[data-testid="menu-integrations"]')).toBeNull();
    expect(container.querySelector('[data-testid="bots-sidebar"]')?.className).toContain(
      "-translate-x-full",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("expands folded page agents only when asked, even with an active page agent", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const renderFixture = (activePageAgent: boolean) =>
    createElement(
      MemoryRouter,
      null,
      createElement(SidebarFixture, {
        mode: "expanded",
        pageAgents: true,
        activePageAgent,
      }),
    );
  try {
    await act(async () => root.render(renderFixture(false)));

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="sidebar-page-agents"]',
    );
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Inbox agent");

    await act(async () => toggle?.click());
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Inbox agent");

    await act(async () => toggle?.click());
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => root.render(renderFixture(true)));
    const activeToggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="sidebar-page-agents"]',
    );
    expect(activeToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Inbox agent");

    await act(async () => activeToggle?.click());
    expect(activeToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Inbox agent");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("keeps one roster row tabbable and moves focus down with ArrowDown", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const rows = () => [...container.querySelectorAll<HTMLButtonElement>("[data-roster-row]")];
  const tabStops = () => rows().filter((row) => row.tabIndex === 0);
  try {
    await act(async () => {
      root.render(
        createElement(MemoryRouter, null, createElement(SidebarFixture, { mode: "expanded" })),
      );
    });

    expect(tabStops()).toHaveLength(1);
    const [current] = tabStops();
    if (!current) throw new Error("Expected one tabbable roster row");
    const next = rows()[rows().indexOf(current) + 1];
    expect(next).toBeDefined();

    await act(async () => {
      current.focus();
      current.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(document.activeElement).toBe(next);
    expect(tabStops()).toEqual([next]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("opens the command palette from expanded and rail Search", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (mode: "expanded" | "rail", key: string) =>
    createElement(MemoryRouter, null, createElement(SidebarFixture, { mode, key }));
  try {
    await act(async () => root.render(render("expanded", "click")));
    const input = container.querySelector<HTMLInputElement>('[data-testid="sidebar-search"] input');
    await act(async () => input?.click());
    expect(container.querySelector('[data-testid="search-open"]')).not.toBeNull();

    await act(async () => root.render(render("expanded", "enter")));
    const enterInput = container.querySelector<HTMLInputElement>(
      '[data-testid="sidebar-search"] input',
    );
    await act(async () => {
      enterInput?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(container.querySelector('[data-testid="search-open"]')).not.toBeNull();

    await act(async () => root.render(render("expanded", "space")));
    const spaceInput = container.querySelector<HTMLInputElement>(
      '[data-testid="sidebar-search"] input',
    );
    await act(async () => {
      spaceInput?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    expect(container.querySelector('[data-testid="search-open"]')).not.toBeNull();

    await act(async () => root.render(render("rail", "rail")));
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="sidebar-search-rail"]')?.click();
    });
    expect(container.querySelector('[data-testid="search-open"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bots-sidebar"]')?.getAttribute("data-rail")).toBe(
      "true",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

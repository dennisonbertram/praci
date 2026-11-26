// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import type { ReactNode } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
const restoreMock = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/rpc")>();
  return {
    ...original,
    rpc: new Proxy(original.rpc, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        return property === "bots"
          ? new Proxy(value, {
              get(botTarget, botProperty, botReceiver) {
                return botProperty === "restore"
                  ? restoreMock
                  : Reflect.get(botTarget, botProperty, botReceiver);
              },
            })
          : value;
      },
    }),
  };
});
vi.mock("@rakazo/ui-web", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/ui-web")>()),
  enqueueNotificationToast: toastMock,
}));

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
  msg: (parts: TemplateStringsArray) => parts[0] ?? "",
  plural: (value: number, forms: { one: string; other: string }) =>
    (value === 1 ? forms.one : forms.other).replace("#", String(value)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (parts: TemplateStringsArray) => parts[0] ?? "",
    i18n: { _: (message: unknown) => String(message) },
  }),
}));
vi.mock("../../components/tour/FirstRunTour", () => ({
  FirstRunTour: ({
    open,
    onSkip,
    onClose,
  }: {
    open: boolean;
    onSkip?: () => void;
    onClose: (me: null, byEscape: boolean) => void;
  }) =>
    open
      ? createElement(
          "div",
          null,
          createElement(
            "button",
            {
              type: "button",
              "data-testid": "tour-skip",
              onClick: () => {
                onSkip?.();
                onClose(null, false);
              },
            },
            "Skip",
          ),
          createElement(
            "button",
            {
              type: "button",
              "data-testid": "tour-close",
              onClick: () => onClose(null, false),
            },
            "Close",
          ),
        )
      : null,
}));
vi.mock("./rows-below", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./rows-below")>()),
  rowsBelow: () => 3,
}));
vi.mock("../ActivityList", () => ({
  ActivityList: ({ onOpenRun }: { onOpenRun: (run: unknown) => void }) =>
    createElement("button", {
      type: "button",
      "data-testid": "activity-open-run",
      onClick: () => onOpenRun({ botId: "bot-1", groupId: null, messageId: "message-1" }),
    }),
}));

import { makeBot } from "../../stories/fixtures";
import {
  activeSpaceFirst,
  commitSpaceRename,
  foldRows,
  sidebarGroupsForSpaces,
  spaceHoldingChat,
  spaceSwitchTargets,
} from "./space-sidebar";
import { SidebarFixture } from "./space-sidebar.stories";

function CurrentPath() {
  const location = useLocation();
  return createElement(
    "output",
    { "data-testid": "current-path" },
    `${location.pathname}${location.search}`,
  );
}

it("opens an activity run at its reply message", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, { mode: "expanded", activityMode: true }),
          createElement(CurrentPath),
        ),
      ),
    );
    await act(async () =>
      container.querySelector<HTMLButtonElement>("[data-testid=activity-open-run]")?.click(),
    );
    expect(container.querySelector("[data-testid=current-path]")?.textContent).toBe(
      "/app/bot-1?m=message-1",
    );
  } finally {
    await act(async () => root.unmount());
  }
});

it("opens Settings from the always-visible sidebar button", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;
  const openSettings = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, { mode: "expanded", openSettings }),
        ),
      ),
    );
    await act(async () =>
      container.querySelector<HTMLButtonElement>("[data-testid=sidebar-settings]")?.click(),
    );
    expect(openSettings).toHaveBeenCalledWith("general");
  } finally {
    await act(async () => root.unmount());
  }
});

it("reports a rejected archived bot restore and keeps the row listed", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  restoreMock.mockRejectedValueOnce(new ORPCError("This voice agent was replaced"));
  const archivedBot = makeBot({ id: "bot_archived", name: "Archived agent" });
  archivedBot.archivedAt = "2026-01-01T00:00:00.000Z";
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, {
            mode: "expanded",
            archivedBots: [archivedBot],
            archivedOpenInitially: true,
          }),
        ),
      ),
    );
    const restoreButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Restore",
    );
    expect(restoreButton).toBeTruthy();
    expect(restoreButton?.disabled).toBe(false);
    await act(async () => restoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(restoreMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "This voice agent was replaced" }),
    );
    expect(container.textContent).toContain("Archived agent");
  } finally {
    restoreMock.mockReset();
    await act(async () => root.unmount());
  }
});

it("disables only the pending archived restore and ignores a second click", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  let resolveRestore!: () => void;
  restoreMock.mockReturnValueOnce(new Promise<void>((resolve) => (resolveRestore = resolve)));
  const archivedBot = makeBot({ id: "bot_archived", name: "Archived agent" });
  archivedBot.archivedAt = "2026-01-01T00:00:00.000Z";
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, {
            mode: "expanded",
            archivedBots: [archivedBot],
            archivedOpenInitially: true,
          }),
        ),
      ),
    );
    const restoreButton = () =>
      [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === "Restore",
      )!;
    let restore = restoreButton();
    await act(async () => restore.click());
    restore = restoreButton();
    expect(restore.disabled).toBe(true);
    const deleteButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Delete",
    );
    expect(deleteButton?.disabled).toBe(false);
    await act(async () => restore.click());
    expect(restoreMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveRestore());
  } finally {
    restoreMock.mockReset();
    await act(async () => root.unmount());
  }
});

function stubSidebarObservers() {
  let frame = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", () => ++frame);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
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
  options: {
    canRename?: boolean;
    canDelete?: boolean;
    bots?: ReturnType<typeof chat>[];
  } = {},
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
  it("leaves out another space that holds only untouched page agents, but keeps the current one", () => {
    const agent = chat("legal", "Legal");
    const spaces = [space("a", "Acme"), space("b", "Side", { bots: [agent] })];
    const untouched = (bot: { id: string }) => bot.id === "legal";
    expect(
      sidebarGroupsForSpaces(spaces, "", "a", "Personal", untouched).map((g) => g.spaceId),
    ).toEqual(["a"]);
    expect(
      sidebarGroupsForSpaces(spaces, "", "b", "Personal", untouched).map((g) => g.spaceId),
    ).toContain("b");
  });

  it("leaves out another space whose only chat is filtered out, even with a saved folder", () => {
    const agent = { ...chat("legal", "Legal"), sectionId: "f1" };
    const side = {
      ...space("b", "Side", { bots: [agent] }),
      botSections: [{ id: "f1", name: "Work" }],
    };
    const spaces = [space("a", "Acme"), side];
    const untouched = (bot: { id: string }) => bot.id === "legal";
    expect(
      sidebarGroupsForSpaces(spaces, "", "a", "Personal", untouched).map((g) => g.spaceId),
    ).toEqual(["a"]);
  });

  it("leaves a hidden bot out of every group", () => {
    const hidden = {
      ...chat("h", "Hidden one"),
      hiddenAt: "2026-01-01T00:00:00.000Z",
    };
    const pinnedHidden = {
      ...chat("p", "Pinned hidden"),
      pinned: true,
      hiddenAt: "2026-01-01",
    };
    const groups = sidebarGroupsForSpaces(
      [
        space("a", "Acme", {
          bots: [chat("c", "Chief"), hidden, pinnedHidden],
        }),
      ],
      "",
      "a",
      "Personal",
    );
    const names = groups.flatMap((g) => g.bots.map((item) => item.chat.name));
    expect(names).toEqual(["Chief"]);
  });

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
    expect(group).toMatchObject({
      title: "Personnel",
      spaceName: "Personal",
      relabeled: true,
    });
  });

  it("lists the only space's chats with no heading or menu, and brings them back with a second space", () => {
    const only = [space("space-1", "Personal", { canRename: true })];
    const [solo] = sidebarGroupsForSpaces(only, "", "space-1", null);
    expect(solo).toMatchObject({
      title: null,
      canRenameSpace: false,
      canDeleteSpace: false,
    });
    expect(solo?.bots).toHaveLength(1);

    const both = sidebarGroupsForSpaces([...only, space("space-2", "Work")], "", "space-1", null);
    expect(both.map((group) => group.title)).toEqual(["Personal", "Work"]);
  });

  it("does not relabel a lone space whose name already matches the label", () => {
    const [group] = sidebarGroupsForSpaces(
      [space("space-1", "Personal")],
      "",
      undefined,
      "Personal",
    );
    expect(group).toMatchObject({
      title: "Personal",
      spaceName: "Personal",
      relabeled: false,
    });
  });

  it("keeps the Personnel heading above pinned agents, folders and the rest", () => {
    const pinned = { ...chat("b1", "Chief"), pinned: true };
    const filed = { ...chat("b2", "Ops"), sectionId: "s1" };
    const loose = chat("b3", "Helper");
    const only = {
      ...space("space-1", "Personal", {
        canRename: true,
        bots: [pinned, filed, loose],
      }),
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
    const only = space("space-1", "Personal", {
      bots: [{ ...chat("b1", "Chief"), pinned: true }],
    });
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
        space("space-2", "Support", {
          canRename: true,
          canDelete: true,
          bots: [],
        }),
      ],
      "",
      undefined,
      "Personnel",
    );

    // Support has no chats, so it has no header; the space switcher is its only way in.
    expect(groups.map((group) => group.title)).toEqual(["Personal"]);
    expect(groups[0]).toMatchObject({
      canRenameSpace: true,
      canDeleteSpace: false,
    });
  });

  it("keeps the active empty space's block so it can still be renamed or deleted", () => {
    const spaces = [
      space("space-1", "Personal"),
      space("space-2", "Empty", { bots: [], canRename: true, canDelete: true }),
    ];
    const groups = sidebarGroupsForSpaces(spaces, "", "space-2");
    expect(groups.map((g) => g.title)).toEqual(["Personal", "Empty"]);
    expect(sidebarGroupsForSpaces(spaces, "", "space-1").map((g) => g.title)).toEqual(["Personal"]);
    expect(groups[1]).toMatchObject({
      canRenameSpace: true,
      canDeleteSpace: true,
      current: true,
    });
  });

  it("marks the space being shown only when several are listed", () => {
    const spaces = [space("space-1", "Personal"), space("space-2", "Empty", { bots: [] })];
    expect(sidebarGroupsForSpaces(spaces, "", "space-1").map((g) => g.current)).toEqual([true]);
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
  stubSidebarObservers();
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
          currentPage: "devin",
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

it("shows Brex only when the space owner's glance says cards are connected", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const renderSidebar = (brexConnected: boolean) =>
    createElement(
      MemoryRouter,
      null,
      createElement(
        "div",
        null,
        createElement(SidebarFixture, { mode: "expanded", currentPage: "brex", brexConnected }),
        createElement(CurrentPath),
      ),
    );
  try {
    await act(async () => {
      root.render(renderSidebar(false));
    });
    expect(container.querySelector('[data-testid="sidebar-brex"]')).toBeNull();

    await act(async () => root.render(renderSidebar(true)));
    const link = container.querySelector<HTMLButtonElement>('[data-testid="sidebar-brex"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.textContent).toContain("Brex");

    await act(async () => {
      link?.click();
    });
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe("/app/brex");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("shows GTM's needs-you count and opens its page", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const renderSidebar = () =>
    createElement(
      MemoryRouter,
      null,
      createElement(
        "div",
        null,
        createElement(SidebarFixture, {
          mode: "expanded",
          currentPage: "gtm",
          gtmNeedsYou: 2,
        }),
        createElement(CurrentPath),
      ),
    );
  try {
    await act(async () => root.render(renderSidebar()));
    const link = container.querySelector<HTMLButtonElement>('[data-testid="sidebar-gtm"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(link?.getAttribute("aria-label")).toBe("GTM, 2 need you");
    expect(link?.querySelector('[data-testid="glance-value"]')?.textContent).toBe("2");

    await act(async () => {
      link?.click();
    });
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe("/app/gtm");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("marks Investors as current and opens its page", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
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
            createElement(SidebarFixture, {
              mode: "expanded",
              currentPage: "investors",
            }),
            createElement(CurrentPath),
          ),
        ),
      );
    });

    const link = container.querySelector<HTMLButtonElement>('[data-testid="sidebar-investors"]');
    expect(link?.getAttribute("aria-current")).toBe("page");

    await act(async () => link?.click());
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe(
      "/app/investors",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("marks Fundraising as current and opens its page", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
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
            createElement(SidebarFixture, {
              mode: "expanded",
              currentPage: "fundraising",
            }),
            createElement(CurrentPath),
          ),
        ),
      );
    });

    const link = container.querySelector<HTMLButtonElement>('[data-testid="sidebar-fundraising"]');
    expect(link?.getAttribute("aria-current")).toBe("page");
    const scrollArea = link?.closest(".max-lg\\:overflow-y-auto");
    expect(scrollArea).not.toBeNull();
    expect(scrollArea?.querySelector(".rk-scroll")?.className).toContain("lg:overflow-y-auto");
    expect(scrollArea?.querySelector(".rk-scroll")?.className).toContain("lg:snap-proximity");

    await act(async () => link?.click());
    expect(container.querySelector('[data-testid="current-path"]')?.textContent).toBe(
      "/app/fundraising",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("forwards tour skip and close callbacks", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;

  const onTourSkip = vi.fn();
  const onTourEnd = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, {
            mode: "expanded",
            tourOpen: true,
            onTourSkip,
            onTourEnd,
          }),
        ),
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="tour-skip"]')?.click();
    });
    expect(onTourSkip).toHaveBeenCalledOnce();
    expect(onTourEnd).toHaveBeenCalledOnce();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="tour-close"]')?.click();
    });
    expect(onTourEnd).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("closes the mobile sidebar when opening Settings", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        createElement(MemoryRouter, null, createElement(SidebarFixture, { mode: "expanded" })),
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="user-menu-trigger"]')?.click();
    });
    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('[aria-label="Settings"]')?.click();
    });

    expect(container.querySelector('[data-testid="bots-sidebar"]')?.className).toContain(
      "-translate-x-full",
    );
    expect(container.textContent).toContain("Open navigation");
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
  stubSidebarObservers();
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

it("hides an unused idle page agent and reveals it when active", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
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
        singlePageAgent: true,
        activePageAgent,
      }),
    );
  try {
    await act(async () => root.render(renderFixture(false)));

    // The header stays (its menu holds New page), but the untouched agent is not listed.
    expect(container.querySelector('[data-testid="sidebar-page-agents"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Inbox agent");

    await act(async () => root.render(renderFixture(true)));
    const activeToggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="sidebar-page-agents"]',
    );
    // The fold stays closed; only the open agent's row shows under it.
    expect(activeToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("Inbox agent");
    await act(async () => activeToggle?.click());
    expect(activeToggle?.getAttribute("aria-expanded")).toBe("true");
    await act(async () => activeToggle?.click());
    expect(activeToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("Inbox agent");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("returns from Activity to chats", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;

  const toggleActivityMode = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, {
            mode: "expanded",
            activityMode: true,
            toggleActivityMode,
          }),
        ),
      );
    });

    const back = container.querySelector<HTMLButtonElement>('[data-testid="activity-back"]');
    expect(back?.textContent).toContain("Back to chats");
    await act(async () => back?.click());
    expect(toggleActivityMode).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("folds email chats separately and reveals the active email chat", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const renderFixture = (activeEmailChat: boolean) =>
    createElement(
      MemoryRouter,
      null,
      createElement(SidebarFixture, {
        mode: "expanded",
        pageAgents: true,
        emailChats: true,
        activeEmailChat,
      }),
    );
  try {
    await act(async () => root.render(renderFixture(false)));

    const pageAgents = container.querySelector<HTMLButtonElement>(
      '[data-testid="sidebar-page-agents"]',
    );
    const emailChats = container.querySelector<HTMLButtonElement>(
      '[data-testid="sidebar-email-chats"]',
    );
    expect(pageAgents).not.toBeNull();
    expect(emailChats?.textContent).toContain("Email chats");
    expect(emailChats?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Client email");

    await act(async () => emailChats?.click());
    expect(emailChats?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Client email");
    expect(container.querySelector('[data-testid="sidebar-page-agents"]')).not.toBeNull();

    await act(async () => emailChats?.click());
    expect(emailChats?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Client email");

    await act(async () => root.render(renderFixture(true)));
    const activeEmailChats = container.querySelector<HTMLButtonElement>(
      '[data-testid="sidebar-email-chats"]',
    );
    expect(activeEmailChats?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("Client email");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("keeps the first and focused roster rows tabbable and moves focus down with ArrowDown", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
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

    expect(tabStops()).toHaveLength(2);
    const [current] = tabStops();
    expect(current).toBe(rows()[0]);
    if (!current) throw new Error("Expected the first tabbable roster row");
    const next = rows()[rows().indexOf(current) + 1];
    expect(next).toBeDefined();

    await act(async () => {
      current.focus();
      current.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(document.activeElement).toBe(next);
    expect(tabStops()).toEqual([current, next]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("makes folder headers, folds and their Actions part of the roster tab stop", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const press = (el: HTMLElement, key: string) =>
    act(async () => {
      el.focus();
      el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  try {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, {
            mode: "expanded",
            pageAgents: true,
            emailChats: true,
          }),
        ),
      );
    });
    const header = container.querySelector<HTMLElement>('[data-sidebar-folder="folder_workspace"]');
    const folder = header?.querySelector<HTMLElement>("button");
    const pageFold = container.querySelector<HTMLElement>('[data-testid="sidebar-page-agents"]');
    const emailFold = container.querySelector<HTMLElement>('[data-testid="sidebar-email-chats"]');
    if (!header || !folder || !pageFold || !emailFold)
      throw new Error("Expected a folder and both folds");
    const others = [header, pageFold.parentElement, emailFold.parentElement].map((wrapper) =>
      [...(wrapper?.querySelectorAll<HTMLElement>("button") ?? [])].at(-1),
    );
    expect(others.filter(Boolean)).toHaveLength(3);
    for (const control of [folder, pageFold, emailFold, ...others]) {
      expect(control?.tabIndex).toBe(-1);
    }

    const rows = [...container.querySelectorAll<HTMLElement>("[data-roster-row]")];
    const above = rows[rows.indexOf(folder) - 1];
    if (!above) throw new Error("Expected a row above the folder");
    await press(above, "ArrowDown");
    expect(document.activeElement).toBe(folder);
    const below = rows[rows.indexOf(pageFold) - 1];
    if (!below) throw new Error("Expected a row above the Page agents fold");
    await press(below, "ArrowDown");
    expect(document.activeElement).toBe(pageFold);
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
  stubSidebarObservers();
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

async function renderSidebar(
  props: Record<string, unknown>,
  check: (c: HTMLElement) => void | Promise<void>,
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  Element.prototype.scrollIntoView ??= () => undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(SidebarFixture, { mode: "expanded", ...props }),
        ),
      ),
    );
    await check(container);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  }
}

it("lists Email chats directly below Page agents, before the other chats", async () => {
  await renderSidebar({ pageAgents: true, crowded: true, emailChats: true }, (container) => {
    const pageAgents = container.querySelector('[data-testid="sidebar-page-agents"]');
    const emailChats = container.querySelector('[data-testid="sidebar-email-chats"]');
    const chat = [...container.querySelectorAll("[data-roster-row]")].find((row) =>
      row.textContent?.includes("Plain chat"),
    );
    if (!pageAgents || !emailChats || !chat) throw new Error("Expected both folds and a chat");
    const following = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(pageAgents.compareDocumentPosition(emailChats) & following).toBeTruthy();
    expect(emailChats.compareDocumentPosition(chat) & following).toBeTruthy();
  });
});

it("treats a page made with New page as a page agent, listed only when unused ones are shown", async () => {
  const open = async (c: HTMLElement) => {
    const fold = c.querySelector<HTMLButtonElement>('[data-testid="sidebar-page-agents"]');
    expect(fold).not.toBeNull();
    await act(async () => fold?.click());
  };
  await renderSidebar({ customPage: true }, async (c) => {
    await open(c);
    expect(c.textContent).not.toContain("New page");
  });
  localStorage.setItem("rakazo.showUnusedPageAgents", "1");
  await renderSidebar({ customPage: true }, async (c) => {
    await open(c);
    expect(c.textContent).toContain("New page");
  });
});

describe("foldRows", () => {
  const row = (id: string) => ({
    depth: 0,
    item: { kind: "bot", chat: { id } },
  });
  const rows = [row("a"), row("b")];

  it("lists every row, nested one level, when the fold is open", () => {
    expect(foldRows(rows, true, "a").map((r) => [r.item.chat.id, r.depth])).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
  });

  it("keeps only the open thread under a closed fold", () => {
    expect(foldRows(rows, false, "b").map((r) => r.item.chat.id)).toEqual(["b"]);
    expect(foldRows(rows, false, "b", false)).toEqual([]);
    expect(foldRows(rows, false, "x")).toEqual([]);
  });
});

it("shows the +N more bar slim, at the bottom of the list", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  stubSidebarObservers();
  const frames: (() => void)[] = [];
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => frames.push(run));
  Element.prototype.scrollIntoView ??= () => undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(MemoryRouter, null, createElement(SidebarFixture, { mode: "expanded" })),
      ),
    );
    await act(async () => {
      for (const run of frames.splice(0)) run();
    });
    const bar = container.querySelector<HTMLElement>('[data-testid="sidebar-more-rows"]');
    expect(bar?.textContent).toBe("+3 more");
    // 28px bar plus the 12px that reaches under the list's foot.
    expect(bar?.style.height).toBe("40px");
    expect(bar?.style.bottom).toBe("-12px");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

describe("bot row click", () => {
  async function clickRow(detail: number, coarse = false) {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: coarse && q === "(pointer: coarse)",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    stubSidebarObservers();
    Element.prototype.scrollIntoView ??= () => undefined;
    const onFocusComposer = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(
          createElement(
            MemoryRouter,
            null,
            createElement(SidebarFixture, {
              mode: "expanded",
              onFocusComposer,
            }),
          ),
        );
      });
      const row = container.querySelector<HTMLElement>('[data-roster-row="bot_ada"]');
      await act(async () => {
        row?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
      });
      return onFocusComposer;
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  }

  it("asks for the message box after a mouse click", async () => {
    expect(await clickRow(1)).toHaveBeenCalledWith("bot_ada");
  });

  it("leaves focus on the row after a keyboard activation or on a touch screen", async () => {
    expect(await clickRow(0)).not.toHaveBeenCalled();
    expect(await clickRow(1, true)).not.toHaveBeenCalled();
  });
});

describe("spaceSwitchTargets", () => {
  it("offers nothing when the member has one Space", () => {
    expect(spaceSwitchTargets([space("a", "Alpha")], "a")).toEqual([]);
  });

  it("leaves out the Space already showing", () => {
    expect(
      spaceSwitchTargets([space("a", "Alpha"), space("b", "Beta"), space("c", "Gamma")], "b").map(
        (target) => target.name,
      ),
    ).toEqual(["Alpha", "Gamma"]);
  });

  it("still offers Spaces the sidebar hides", () => {
    const empty = space("empty", "Empty space", { bots: [] });
    const untouched = space("untouched", "Mail needs reconnect", { bots: [] });
    expect(
      spaceSwitchTargets([space("a", "Alpha"), empty, untouched], "a").map((target) => target.id),
    ).toEqual(["empty", "untouched"]);
  });
});

// @vitest-environment jsdom

import type { AgentSkillCatalogEntry, ThreadMessage } from "@rakazo/contracts";
import type { ComposerMention } from "@rakazo/core";
import type { ComponentProps, ReactNode } from "react";
import { act, createRef } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  msg: (parts: TemplateStringsArray) => parts[0],
  t: (parts: TemplateStringsArray) => parts.join(""),
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
}));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return {
    useLingui: () => ({ t, i18n: { locale: "en", _: (message: unknown) => String(message) } }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});

const menuToast = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/ui-web", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/ui-web")>()),
  enqueueNotificationToast: menuToast,
}));

const routineLinkRpc = vi.hoisted(() => ({
  computerBoot: vi.fn(async () => ({})),
  botsList: vi.fn(async () => [
    {
      id: "b1",
      name: "Bot",
      spawnKey: null,
      description: "",
      preview: "",
      title: "",
      color: "#000",
      status: "idle",
    },
  ]),
  routinesList: vi.fn(async (_input: { botId: string }): Promise<unknown[]> => []),
  skillsList: vi.fn(async () => []),
  threadsGet: vi.fn(async ({ botId }: { botId: string }, _options?: unknown) => ({
    botId,
    threadId: `t-${botId}`,
    messages: [],
    computer: null,
    olderCursor: null,
  })),
}));
vi.mock("../lib/auth", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "u1" } } }) },
}));
vi.mock("../lib/hex/useHexSync", () => ({ useHexSync: () => {} }));
vi.mock("../components/SidebarPages", () => ({ SidebarPages: () => null }));
vi.mock("./shell/bot-pins", () => ({
  PinsList: () => null,
  PinsStrip: () => null,
  useBotPins: () => [null, () => {}],
}));

const searchHits = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));
const paletteRpc = vi.hoisted(() => ({
  folders: 0,
  contacts: 0,
  foldersFail: false,
  contactsFail: false,
  listSpace: [] as { q?: string; limit?: number }[],
}));

vi.mock("../lib/rpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rpc")>();
  const defaults = new Proxy({}, { get: () => async () => ({}) });
  const rpcOverrides = {
    ...actual.rpc,
    bootstrap: async () => ({
      me: { ticketBoardEnabled: false, userId: "u1", hideAmounts: false },
      bots: [
        {
          id: "b1",
          name: "Bot",
          spawnKey: null,
          description: "",
          preview: "",
          title: "",
          color: "#000",
          status: "idle",
        },
      ],
      botSections: [],
      archivedBots: [],
      archivedGroups: [],
      groups: [],
      spaces: [],
      routines: [],
    }),
    bots: { ...actual.rpc.bots, list: routineLinkRpc.botsList },
    routines: { ...actual.rpc.routines, list: routineLinkRpc.routinesList },
    skills: { ...actual.rpc.skills, list: routineLinkRpc.skillsList },
    taughtSkills: { list: async () => [] },
    threads: {
      ...actual.rpc.threads,
      get: routineLinkRpc.threadsGet,
    },
    computer: { ...actual.rpc.computer, boot: routineLinkRpc.computerBoot },
    spaces: {
      ...actual.rpc.spaces,
      list: async () => ({
        current: {
          bots: [
            {
              id: "b1",
              name: "Bot",
              spawnKey: null,
              description: "",
              preview: "",
              title: "",
              color: "#000",
              status: "idle",
            },
          ],
          botSections: [],
          groups: [],
        },
        spaces: [],
      }),
    },
    inbox: { unreadCount: async () => ({ count: 0 }) },
    notifications: {
      unseenCounts: async () => ({ counts: {} }),
      glance: async () => ({ botKinds: {} }),
    },
    search: { query: async () => ({ hits: searchHits.current }) },
    contacts: {
      list: async () => {
        paletteRpc.contacts += 1;
        if (paletteRpc.contactsFail) throw new Error("contacts down");
        return [{ id: "c1", name: "Halcyon Capital", email: "a@halcyon.test", organization: null }];
      },
    },
    dataRoom: {
      search: async () => ({
        results: [
          {
            item: { id: "d1", name: "Deal", folderId: null },
            ordinal: 1,
            snippet: "Payment: $1,250",
          },
        ],
      }),
      folders: async () => {
        paletteRpc.folders += 1;
        if (paletteRpc.foldersFail) throw new Error("folders down");
        return [];
      },
    },
    artifacts: {
      listSpace: async (input: { q?: string; limit?: number }) => {
        paletteRpc.listSpace.push(input);
        return { items: [{ id: "a1", name: "Report", description: "Costs $9,900 total" }] };
      },
    },
  };
  const methodFallback = (key: PropertyKey) => async () =>
    ["list", "listArchived", "messages"].includes(String(key)) ? [] : {};
  return {
    ...actual,
    rpc: new Proxy(rpcOverrides, {
      get: (target, key: string) => {
        const value = Reflect.get(target, key);
        if (value === undefined) return defaults;
        if (typeof value !== "object" || value === null) return value;
        return new Proxy(value, {
          get: (namespace, method: PropertyKey) =>
            Reflect.get(namespace, method) ?? methodFallback(method),
        });
      },
    }),
  };
});

import { findGtmAgent } from "../lib/gtm-agent";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { ShellPage } from "./Shell";

it("selects only the signed-in founder's GTM panel agent", () => {
  const bots = [
    { spawnKey: "gtm-agent:other", id: "other" },
    { spawnKey: "gtm-agent:owner", id: "mine" },
  ];
  expect(findGtmAgent(bots, "owner")?.id).toBe("mine");
  expect(findGtmAgent(bots, null)).toBeUndefined();
});

import {
  answerThenRefresh,
  BOTS_POLL_MS,
  Composer,
  catchBotMenuRequest,
  chatIsOpening,
  createPaletteLookupCache,
  findChats,
  findContacts,
  findDocumentsAndArtifacts,
  firstThreadRoute,
  isRoutinesOnlyPanel,
  reopensAfterUndo,
  retryAfterStop,
  settingsSectionFromParam,
  showsComputerCaption,
  Transcript,
  uniqueBotName,
  useScratchpadFocus,
} from "./Shell";

describe("bot menu request failures", () => {
  beforeEach(() => menuToast.mockClear());

  it("shows a rejected pin request in a toast", async () => {
    const error = new Error("pin update rejected");
    await catchBotMenuRequest(Promise.reject(error), "bot-1");
    expect(menuToast).toHaveBeenCalledWith({
      id: "chat-menu-bot-1",
      title: "pin update rejected",
    });
  });

  it("shows a rejected mark unread request in a toast", async () => {
    const error = new Error("read update rejected");
    await catchBotMenuRequest(Promise.reject(error), "bot-1");
    expect(menuToast).toHaveBeenCalledWith({
      id: "chat-menu-bot-1",
      title: "read update rejected",
    });
  });
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let composerProps: ComponentProps<typeof Composer>;

afterEach(() => {
  setHideAmounts(false);
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

it("reopens an archived chat only where the archive landed, at click and at resolve", () => {
  const open = { wasOpen: true, landedPath: "/app/botA" };
  // The archive redirected to botA and nothing has opened since, so Undo returns.
  expect(reopensAfterUndo(open, "/app/botA", "/app/botA")).toBe(true);
  // An unrelated route after a group archive is not the landing, so Undo stays put.
  expect(reopensAfterUndo(open, "/app/botA", "/app/botB")).toBe(false);
  expect(reopensAfterUndo(open, "/app/botA", "/app/integrations")).toBe(false);
  expect(reopensAfterUndo(open, "/app/botA", "/app/g/groupA")).toBe(false);
  // It was never the open chat, so Undo only puts it back in the sidebar.
  expect(
    reopensAfterUndo({ wasOpen: false, landedPath: "/app/botA" }, "/app/botA", "/app/botA"),
  ).toBe(false);
  // Undo was clicked somewhere else, or the view moved while the restore was pending.
  expect(reopensAfterUndo(open, "/app/botB", "/app/botB")).toBe(false);
  expect(reopensAfterUndo(open, "/app/botA", "/app/integrations")).toBe(false);
});

it("maps ?settings= to a settings section", () => {
  expect(settingsSectionFromParam(null)).toBeNull();
  expect(settingsSectionFromParam("privacy")).toBe("privacy");
  expect(settingsSectionFromParam("general")).toBe("general");
  expect(settingsSectionFromParam("models")).toBe("models");
  expect(settingsSectionFromParam("voice")).toBe("voice");
  expect(settingsSectionFromParam("connections")).toBe("connections");
  expect(settingsSectionFromParam("nope")).toBe("general");
});

it("carries a pending ?settings= link through the first-chat redirect", () => {
  const bots = [{ id: "b1", spawnKey: null }];
  expect(firstThreadRoute(bots, [], "?settings=privacy")).toBe("/app/b1?settings=privacy");
  expect(firstThreadRoute(bots, [], "?settings=connections")).toBe("/app/b1?settings=connections");
  expect(firstThreadRoute(bots, [], "?m=1")).toBe("/app/b1");
  expect(firstThreadRoute([], [], "?settings=general")).toBe("/app?settings=general");
});

it("strips an unknown routine link without opening the computer panel", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  routineLinkRpc.computerBoot.mockClear();
  window.matchMedia ??= (query: string) =>
    ({
      matches: !query.includes("pointer"),
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollTo ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  const Location = () => <span data-testid="location">{useLocation().search}</span>;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={["/app/b1?routine=missing"]}>
        <Location />
        <Routes>
          <Route path="/app/:botId" element={<ShellPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(container.querySelector('[data-testid="location"]')?.textContent).not.toContain(
    "routine=",
  );
  const computerPanelButton = container.querySelector('[aria-label="Routines"]');
  expect(computerPanelButton?.hasAttribute("data-active")).toBe(false);
  expect(routineLinkRpc.computerBoot).not.toHaveBeenCalled();
});

it("starts side refreshes in parallel and ignores routines after the active bot changes", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  const bot = (id: string) => ({
    id,
    name: `Bot ${id}`,
    spawnKey: null,
    description: "",
    preview: "",
    title: "",
    color: "#000",
    status: "idle",
  });
  routineLinkRpc.botsList.mockResolvedValue([bot("b1"), bot("b2")]);
  let resolveThread!: (snapshot: Awaited<ReturnType<typeof routineLinkRpc.threadsGet>>) => void;
  let holdFirstThread = true;
  const startOrder: string[] = [];
  routineLinkRpc.threadsGet.mockClear();
  routineLinkRpc.threadsGet.mockImplementation((input) => {
    startOrder.push(`thread:${input.botId}`);
    const snapshot = {
      botId: input.botId,
      threadId: `t-${input.botId}`,
      messages: [],
      computer: null,
      olderCursor: null,
    };
    if (holdFirstThread && input.botId === "b1") {
      holdFirstThread = false;
      return new Promise((resolve) => (resolveThread = resolve));
    }
    return Promise.resolve(snapshot);
  });
  routineLinkRpc.routinesList.mockClear();
  routineLinkRpc.routinesList.mockImplementation(async ({ botId }: { botId: string }) => {
    startOrder.push(`routines:${botId}`);
    return botId === "b1"
      ? [
          {
            id: "old-routine",
            botId,
            name: "Old routine",
            managedKind: null,
            crons: [],
            timezone: "UTC",
            active: true,
            webhookEnabled: false,
            githubEnabled: false,
            messageProvider: null,
            watch: null,
            status: {
              lastRunAt: null,
              nextRunAt: null,
              lastCheckedAt: null,
              lastChangedAt: null,
              pausedReason: null,
            },
          },
        ]
      : [];
  });
  window.matchMedia ??= (query: string) =>
    ({
      matches: !query.includes("pointer"),
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollTo ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  function SwitchBot() {
    const navigate = useNavigate();
    return (
      <button type="button" data-testid="switch-bot" onClick={() => navigate("/app/b2")}>
        Switch bot
      </button>
    );
  }
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={["/app/b1"]}>
        <SwitchBot />
        <Routes>
          <Route path="/app/:botId" element={<ShellPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(startOrder.indexOf("routines:b1")).toBeGreaterThanOrEqual(0);
  expect(startOrder.indexOf("routines:b1")).toBeLessThan(startOrder.indexOf("thread:b1"));

  await act(async () => {
    container?.querySelector<HTMLButtonElement>("[data-testid='switch-bot']")?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  await act(async () => {
    resolveThread({
      botId: "b1",
      threadId: "t-b1",
      messages: [],
      computer: null,
      olderCursor: null,
    });
  });
  expect(container?.textContent).not.toContain("Old routine");
});

it("does not land on a page's auto-created agent, so a space holding only that stays empty", () => {
  const legal = { id: "legal", spawnKey: "legal-agent:user-1" };
  expect(firstThreadRoute([legal], [])).toBe("/app");
  expect(firstThreadRoute([legal, { id: "b2", spawnKey: null }], [])).toBe("/app/b2");
});

it("names a second new bot New Bot 2", () => {
  expect(uniqueBotName("New Bot", [])).toBe("New Bot");
  expect(uniqueBotName("New Bot", ["New Bot"])).toBe("New Bot 2");
  expect(uniqueBotName("New Bot", ["New Bot", "New Bot 2"])).toBe("New Bot 3");
});

const bob: ComposerMention = { kind: "bot", id: "bot-2", name: "Bob" };
const summarize: AgentSkillCatalogEntry = {
  id: "skill-1",
  name: "summarize",
  description: "Summarize a document",
  source: "user",
  readOnly: false,
};

function renderComposer(
  onSend: ComponentProps<typeof Composer>["onSend"],
  overrides: Partial<ComponentProps<typeof Composer>> = {},
) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // Reduced motion skips the chip-row resize animation, which jsdom cannot run.
  window.matchMedia ??= (query: string) =>
    ({
      matches: !query.includes("pointer"),
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  composerProps = {
    artifactTarget: { botId: "bot-1" },
    activeName: "Ada",
    running: false,
    pendingAttachments: [],
    attachmentNotice: null,
    sendError: null,
    runError: null,
    runErrorId: null,
    onRunErrorPresented: () => {},
    onDismissError: () => {},
    sending: false,
    fileInputRef: createRef(),
    onAttachmentPick: () => true,
    onRemoveAttachment: () => {},
    onSend,
    onStop: async () => {},
    mentionTargets: [bob],
    agentSkills: [summarize],
    ...overrides,
  };
  rerenderComposer({});
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("composer textarea not found");
  return textarea;
}

function rerenderComposer(overrides: Partial<ComponentProps<typeof Composer>>) {
  composerProps = { ...composerProps, ...overrides };
  act(() => root?.render(<Composer {...composerProps} />));
}

function pickAttachment() {
  const input = container?.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("attachment input not found");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["notes"], "notes.txt", { type: "text/plain" })],
  });
  act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
}

function type(textarea: HTMLTextAreaElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setValue?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressEnter(textarea: HTMLTextAreaElement) {
  act(() => {
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

describe("Composer", () => {
  it("inserts a dictated multi-paragraph block at the caret: draft, caret, saved draft and Send", () => {
    // System dictation (Wispr Flow) inserts text into the field like a keyboard.
    const onSend = vi.fn();
    const textarea = renderComposer(onSend, { draftKey: "bot:dictation" });
    const send = container?.querySelector<HTMLButtonElement>('button[aria-label="Send"]');
    const prefix = "Before ";
    const suffix = " after";
    type(textarea, prefix + suffix);
    const dictated = "First paragraph.\n\nSecond paragraph, with a / slash.";
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      textarea.setSelectionRange(prefix.length, prefix.length);
      // What the browser does for insertText: replace the selection, caret after the text.
      setValue?.call(textarea, prefix + dictated + suffix);
      const caret = prefix.length + dictated.length;
      textarea.setSelectionRange(caret, caret);
      textarea.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: dictated }),
      );
    });
    const expected = prefix + dictated + suffix;
    const caret = prefix.length + dictated.length;
    expect(textarea.value).toBe(expected);
    expect(textarea.selectionStart).toBe(caret);
    expect(textarea.selectionEnd).toBe(caret);
    expect(sessionStorage.getItem("rakazo.chatDraft:bot:dictation")).toBe(expected);
    expect(send?.disabled).toBe(false);
    sessionStorage.clear();
  });

  it("loads connector mentions only when opening the mention picker", () => {
    const onMentionOpen = vi.fn();
    const textarea = renderComposer(vi.fn(), { onMentionOpen });
    type(textarea, "A normal message");
    expect(onMentionOpen).not.toHaveBeenCalled();
    type(textarea, "@");
    expect(onMentionOpen).toHaveBeenCalledTimes(1);
    type(textarea, "@Bo");
    expect(onMentionOpen).toHaveBeenCalledTimes(1);
    type(textarea, "");
    type(textarea, "@");
    expect(onMentionOpen).toHaveBeenCalledTimes(2);
  });

  it("shows Call Elio and Stop while a run goes on with nothing typed, and Send and Stop once there is", () => {
    const textarea = renderComposer(async () => true, { running: true, onVoice: () => {} });
    const labels = () =>
      [...(container?.querySelectorAll("button[aria-label]") ?? [])]
        .map((b) => b.getAttribute("aria-label"))
        .filter((label) => label === "Call Elio" || label === "Send" || label === "Stop");
    expect(labels()).toEqual(["Call Elio", "Stop"]);
    type(textarea, "one more thing");
    expect(labels()).toEqual(["Send", "Stop"]);
  });

  it("lets the person dismiss the skipped-attachment notice", () => {
    const onDismissAttachmentNotice = vi.fn();
    renderComposer(async () => true, {
      attachmentNotice: "Skipped big.mp4 (over 10 MB)",
      onDismissAttachmentNotice,
    });
    const dismiss = container?.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
    act(() => dismiss?.click());
    expect(onDismissAttachmentNotice).toHaveBeenCalledTimes(1);
  });

  it("shows a chip for a Data room file sent to the agent, lets Send run with no text, and removes it", () => {
    const onSend = vi.fn(async () => true);
    const onRemoveDataRoomItem = vi.fn();
    const ref = {
      id: "itm_1",
      name: "Sample agreement.pdf",
      mimeType: "application/pdf",
      threadKey: "bot-1",
    };
    renderComposer(onSend, { dataRoomItems: [ref], onRemoveDataRoomItem });
    const chip = container?.querySelector('[data-testid="data-room-chip"]');
    expect(chip?.textContent).toContain("Sample agreement.pdf");
    // Not sent until the person presses Send.
    expect(onSend).not.toHaveBeenCalled();
    const send = container?.querySelector<HTMLButtonElement>('button[aria-label="Send"]');
    expect(send?.disabled).toBe(false);
    act(() => chip?.querySelector("button")?.click());
    expect(onRemoveDataRoomItem).toHaveBeenCalledWith(ref);
  });

  describe("mention highlight when targets reload", () => {
    const researcher: ComposerMention = { kind: "bot", id: "bot-3", name: "Researcher" };
    const writer: ComposerMention = { kind: "bot", id: "bot-4", name: "Research Writer" };
    const routine: ComposerMention = { kind: "routine", id: "r1", name: "Research digest" };

    function openOnWriter(targets: ComposerMention[]) {
      const textarea = renderComposer(vi.fn(), { mentionTargets: targets });
      type(textarea, "@Res");
      act(() => {
        textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      });
      return textarea;
    }
    const selected = () =>
      container?.querySelector("[role='option'][aria-selected='true']")?.textContent;
    const chips = () =>
      [...(container?.querySelectorAll("[data-testid='mention-chip']") ?? [])].map(
        (chip) => chip.textContent,
      );
    const pressKey = (textarea: HTMLTextAreaElement, key: string) =>
      act(() => {
        textarea.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });

    it("survives a new targets array", () => {
      const textarea = openOnWriter([researcher, writer]);
      expect(selected()).toContain("Research Writer");
      rerenderComposer({ mentionTargets: [researcher, writer] });
      expect(selected()).toContain("Research Writer");
      pressKey(textarea, "Enter");
      expect(chips()).toEqual(["@Research Writer"]);
    });

    it("follows the highlighted option when an option is inserted before it", () => {
      const textarea = openOnWriter([researcher, writer]);
      rerenderComposer({ mentionTargets: [routine, researcher, writer] });
      expect(selected()).toContain("Research Writer");
      pressKey(textarea, "Enter");
      expect(chips()).toEqual(["@Research Writer"]);
    });

    it("keeps the default highlight on the first option when an option is inserted before it", () => {
      const textarea = renderComposer(vi.fn(), { mentionTargets: [researcher, writer] });
      type(textarea, "@Res");
      expect(selected()).toContain("Researcher");
      rerenderComposer({ mentionTargets: [routine, researcher, writer] });
      expect(selected()).toContain("Researcher");
      pressKey(textarea, "Enter");
      expect(chips()).toEqual(["@Researcher"]);
    });

    it("falls back to the first option when the highlighted option disappears", () => {
      const textarea = openOnWriter([researcher, writer]);
      rerenderComposer({ mentionTargets: [researcher] });
      expect(selected()).toContain("Researcher");
      pressKey(textarea, "Enter");
      expect(chips()).toEqual(["@Researcher"]);
    });
  });

  describe("mention picker with no matches", () => {
    const keydown = (textarea: HTMLTextAreaElement, init: KeyboardEventInit) => {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
      act(() => {
        textarea.dispatchEvent(event);
      });
      return event;
    };

    it("announces the empty state and blocks Enter until Escape", () => {
      const textarea = renderComposer(vi.fn());
      type(textarea, "@zz");
      const empty = container?.querySelector("[data-testid='mention-picker-empty']");
      expect(empty?.getAttribute("role")).toBe("status");
      expect(keydown(textarea, { key: "Enter" }).defaultPrevented).toBe(true);
    });

    it("does not send from the Send button while No matches shows", () => {
      const onSend = vi.fn().mockResolvedValue(true);
      const textarea = renderComposer(onSend);
      type(textarea, "@zz");
      const send = container?.querySelector<HTMLButtonElement>('button[aria-label="Send"]');
      expect(send).not.toBeNull();
      act(() => send?.click());
      expect(onSend).not.toHaveBeenCalled();
      // Control: the same button sends once the query no longer matches nothing.
      type(textarea, "hello");
      act(() => send?.click());
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it("leaves Enter alone while an IME is composing", () => {
      const textarea = renderComposer(vi.fn());
      type(textarea, "@zz");
      expect(keydown(textarea, { key: "Enter", isComposing: true }).defaultPrevented).toBe(false);
    });
  });

  it("keeps a half-written message when the user leaves the chat and comes back", () => {
    let textarea = renderComposer(vi.fn(), { draftKey: "bot:chief" });
    type(textarea, "Draft about board meeting agenda");
    act(() => root?.unmount());
    container?.remove();
    textarea = renderComposer(vi.fn(), { draftKey: "bot:carta" });
    expect(textarea.value).toBe("");
    act(() => root?.unmount());
    container?.remove();
    textarea = renderComposer(vi.fn(), { draftKey: "bot:chief" });
    expect(textarea.value).toBe("Draft about board meeting agenda");
    sessionStorage.clear();
  });

  it("keeps a chosen skill chip when the user leaves the chat and comes back", () => {
    const skillChip = () => container?.querySelector("[data-testid='skill-chip']")?.textContent;
    const textarea = renderComposer(vi.fn(), { draftKey: "bot:chief" });
    type(textarea, "/sum");
    act(() =>
      container?.querySelector<HTMLButtonElement>("button[aria-label='Skill summarize']")?.click(),
    );
    expect(skillChip()).toBe("summarize");
    act(() => root?.unmount());
    container?.remove();
    renderComposer(vi.fn(), { draftKey: "bot:carta" });
    expect(skillChip()).toBeUndefined();
    act(() => root?.unmount());
    container?.remove();
    renderComposer(vi.fn(), { draftKey: "bot:chief" });
    expect(skillChip()).toBe("summarize");
    sessionStorage.clear();
  });

  it("keeps a chosen @mention chip when the user leaves the chat and comes back", () => {
    const legal: ComposerMention = { kind: "bot", id: "bot-legal", name: "Legal" };
    const chips = () =>
      [...(container?.querySelectorAll("[data-testid='mention-chip']") ?? [])].map(
        (chip) => chip.textContent,
      );
    const textarea = renderComposer(vi.fn(), { draftKey: "group:g1", mentionTargets: [legal] });
    type(textarea, "@Leg");
    act(() => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(chips()).toEqual(["@Legal"]);
    act(() => root?.unmount());
    container?.remove();
    renderComposer(vi.fn(), { draftKey: "bot:carta", mentionTargets: [legal] });
    expect(chips()).toEqual([]);
    act(() => root?.unmount());
    container?.remove();
    renderComposer(vi.fn(), { draftKey: "group:g1", mentionTargets: [legal] });
    expect(chips()).toEqual(["@Legal"]);
    sessionStorage.clear();
  });

  it("moves through the / menu with the arrow keys and picks with Enter", () => {
    const onSend = vi.fn();
    const onSlashAction = vi.fn();
    const textarea = renderComposer(onSend, { onSlashAction });
    type(textarea, "/");
    const selected = () =>
      container?.querySelector("[data-testid='slash-picker'] [aria-selected='true']")?.textContent;
    expect(selected()).toContain("summarize");
    const sections = [
      ...(container?.querySelectorAll("[data-testid='slash-picker'] [role='presentation']") ?? []),
    ].map((node) => node.textContent);
    expect(sections).toEqual(["Skills", "Actions"]);
    act(() => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );
    });
    expect(selected()).toBe("Chat settings");
    pressEnter(textarea);
    expect(onSlashAction).toHaveBeenCalledWith("chat-settings");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("offers Goal in the / menu and inserts the command into the draft", () => {
    const onSend = vi.fn();
    const onSlashAction = vi.fn();
    const textarea = renderComposer(onSend, { onSlashAction });
    type(textarea, "/goa");
    const option = container?.querySelector<HTMLButtonElement>(
      "[data-testid='slash-picker'] [role='option']",
    );
    expect(option?.textContent).toBe("Goal");
    act(() => option?.click());
    expect(textarea.value).toBe("/goal ");
    expect(onSend).not.toHaveBeenCalled();
    expect(onSlashAction).not.toHaveBeenCalled();
    expect(container?.querySelector("[data-testid='slash-picker']")).toBeNull();
  });

  it("clears the draft once the message is sent", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    const textarea = renderComposer(onSend);
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    expect(onSend).toHaveBeenCalledWith("hello", [], expect.any(String));
    expect(textarea.value).toBe("");
  });

  it("keeps the draft cleared when the send callback rejects", async () => {
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error("unknown outcome"))
      .mockResolvedValue(true);
    const textarea = renderComposer(onSend);
    type(textarea, "@Bo");
    pressEnter(textarea);
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    expect(textarea.value).toBe("");
    expect(container?.querySelector("[data-testid='mention-chip']")).toBeNull();
    type(textarea, "another message");
    pressEnter(textarea);
    await act(async () => {});
    expect(onSend.mock.calls[1]?.[2]).not.toBe(onSend.mock.calls[0]?.[2]);
  });

  it("restores the draft and its mentions when the send fails", async () => {
    let finishSend = (_sent: boolean) => {};
    const onSend = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSend = resolve;
        }),
    );
    const textarea = renderComposer(onSend);
    const mentionChips = () =>
      [...(container?.querySelectorAll("[data-testid='mention-chip']") ?? [])].map(
        (chip) => chip.textContent,
      );
    type(textarea, "@Bo");
    pressEnter(textarea);
    expect(textarea.value).toBe("@Bob ");
    type(textarea, "@Bob hello");
    pressEnter(textarea);
    expect(onSend).toHaveBeenCalledWith("@Bob hello", [bob], expect.any(String));
    expect(textarea.value).toBe("");
    expect(mentionChips()).toEqual([]);
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("@Bob hello");
    expect(mentionChips()).toEqual(["@Bob"]);
  });

  it("puts a mention at the caret mid-sentence and sends the sentence as written", () => {
    const onSend = vi.fn();
    const textarea = renderComposer(onSend);
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    const typed = "share with @Bo and put it away";
    act(() => {
      setValue?.call(textarea, typed);
      textarea.setSelectionRange(14, 14);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    pressEnter(textarea);
    expect(textarea.value).toBe("share with @Bob and put it away");
    const chips = [...(container?.querySelectorAll("[data-testid='mention-chip']") ?? [])];
    expect(chips.map((chip) => chip.textContent)).toEqual(["@Bob"]);
    // The picked name sits between the surrounding words, and nothing leads the text.
    pressEnter(textarea);
    expect(onSend).toHaveBeenCalledWith(
      "share with @Bob and put it away",
      [bob],
      expect.any(String),
    );
  });

  it("drops a mention when its text is edited, and Backspace removes it whole", () => {
    const textarea = renderComposer(vi.fn());
    const chips = () =>
      [...(container?.querySelectorAll("[data-testid='mention-chip']") ?? [])].length;
    type(textarea, "@Bo");
    pressEnter(textarea);
    expect(chips()).toBe(1);
    type(textarea, "@Bo hello");
    expect(chips()).toBe(0);
    type(textarea, "@Bo");
    pressEnter(textarea);
    expect(textarea.value).toBe("@Bob ");
    act(() => {
      textarea.setSelectionRange(4, 4);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
      );
    });
    expect(textarea.value).toBe(" ");
    expect(chips()).toBe(0);
  });

  it("keeps two same-name mentions apart and sends each one's own id", () => {
    const first: ComposerMention = { kind: "routine", id: "r1", name: "Weekly report" };
    const second: ComposerMention = { kind: "routine", id: "r2", name: "Weekly report" };
    const onSend = vi.fn();
    const textarea = renderComposer(onSend, { mentionTargets: [first, second] });
    type(textarea, "@Weekly");
    pressEnter(textarea);
    type(textarea, `${textarea.value}and @Weekly`);
    act(() => {
      container
        ?.querySelector<HTMLButtonElement>("[role=option]:last-child")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(textarea.value).toBe("@Weekly report and @Weekly report ");
    // Deleting the first leaves the second with its own id.
    act(() => {
      textarea.setSelectionRange(14, 14);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
      );
    });
    expect(container?.querySelectorAll("[data-testid='mention-chip']").length).toBe(1);
    type(textarea, `${textarea.value}go`);
    pressEnter(textarea);
    expect(onSend).toHaveBeenCalledWith("and @Weekly report go", [second], expect.any(String));
  });

  it("does not remove a mention on Backspace while composing", () => {
    const textarea = renderComposer(vi.fn());
    type(textarea, "@Bo");
    pressEnter(textarea);
    act(() => {
      textarea.setSelectionRange(4, 4);
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Backspace", keyCode: 229, bubbles: true }),
      );
    });
    expect(textarea.value).toBe("@Bob ");
  });

  it("names the status of a routine mention under the field", () => {
    const routine: ComposerMention = { kind: "routine", id: "r1", name: "Digest" };
    const textarea = renderComposer(vi.fn(), { mentionTargets: [routine] });
    type(textarea, "@Dig");
    pressEnter(textarea);
    const status = document.getElementById(textarea.getAttribute("aria-describedby") ?? "");
    expect(status?.textContent).toBe("Digest · Runs on send");
  });

  it("restores the chosen skill when the send fails", async () => {
    let finishSend = (_sent: boolean) => {};
    const onSend = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSend = resolve;
        }),
    );
    const textarea = renderComposer(onSend);
    const skillChip = () => container?.querySelector("[data-testid='skill-chip']")?.textContent;
    type(textarea, "/sum");
    act(() =>
      container?.querySelector<HTMLButtonElement>("button[aria-label='Skill summarize']")?.click(),
    );
    type(textarea, "the notes");
    pressEnter(textarea);
    expect(onSend).toHaveBeenCalledWith("/summarize\nthe notes", [], expect.any(String));
    expect(skillChip()).toBeUndefined();
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("the notes");
    expect(skillChip()).toBe("summarize");
  });

  it("keeps a newer draft when an earlier send fails", async () => {
    let finishSend = (_sent: boolean) => {};
    const textarea = renderComposer(
      () =>
        new Promise<boolean>((resolve) => {
          finishSend = resolve;
        }),
    );
    type(textarea, "hello");
    pressEnter(textarea);
    type(textarea, "newer");
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("newer");
  });

  it("does not restore after a newer draft was typed then cleared while sending", async () => {
    let finishSend = (_sent: boolean) => {};
    const textarea = renderComposer(
      () =>
        new Promise<boolean>((resolve) => {
          finishSend = resolve;
        }),
    );
    type(textarea, "hello");
    pressEnter(textarea);
    type(textarea, "newer");
    type(textarea, "");
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("");
  });

  it("reuses the nonce on an unchanged retry but renews it after an edit", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    const textarea = renderComposer(onSend);
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    pressEnter(textarea);
    await act(async () => {});
    const firstNonce = onSend.mock.calls[0]?.[2];
    expect(firstNonce).toEqual(expect.any(String));
    expect(onSend.mock.calls[1]?.[2]).toBe(firstNonce);
    type(textarea, "hello edited");
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    expect(onSend.mock.calls[2]?.[2]).not.toBe(firstNonce);
  });

  it("does not restore after an attachment was picked while sending", async () => {
    let finishSend = (_sent: boolean) => {};
    const textarea = renderComposer(
      () =>
        new Promise<boolean>((resolve) => {
          finishSend = resolve;
        }),
    );
    type(textarea, "hello");
    pressEnter(textarea);
    pickAttachment();
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("");
  });

  it("restores after a rejected attachment pick and preserves the nonce on rejected retry picks", async () => {
    let finishSend = (_sent: boolean) => {};
    const onSend = vi.fn<ComponentProps<typeof Composer>["onSend"]>(
      () =>
        new Promise<boolean>((resolve) => {
          finishSend = resolve;
        }),
    );
    const onAttachmentPick = vi.fn(() => false);
    const textarea = renderComposer(onSend, { onAttachmentPick });
    type(textarea, "hello");
    pressEnter(textarea);
    pickAttachment();
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("hello");
    pickAttachment();
    pressEnter(textarea);
    await act(async () => finishSend(false));
    expect(onAttachmentPick).toHaveBeenCalledTimes(2);
    expect(onSend.mock.calls[1]?.[2]).toBe(onSend.mock.calls[0]?.[2]);
  });

  const reply: ThreadMessage = {
    id: "message-1",
    threadId: "thread-1",
    seq: 1,
    role: "bot",
    blocks: [{ kind: "text", text: "original reply" }],
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  it("masks currency amounts in the reply preview while amounts are hidden", () => {
    const spent: ThreadMessage = {
      ...reply,
      blocks: [{ kind: "text", text: "You spent $73,781.83 last month" }],
    };
    setHideAmounts(true);
    renderComposer(vi.fn(), { replyTarget: spent, replyQuote: "spent $73,781.83" });
    expect(container?.textContent).not.toContain("73,781");
    expect(container?.textContent).toContain("You spent $••• last month");
  });

  const replyChanges = [
    { name: "cancelled reply", props: { replyTarget: null, replyQuote: null } },
    { name: "different reply", props: { replyTarget: { ...reply, id: "message-2" } } },
    { name: "different quote", props: { replyQuote: "different quote" } },
  ];

  it.each(replyChanges)("renews the retry nonce for a $name", async ({ props }) => {
    const onSend = vi.fn().mockResolvedValue(false);
    const textarea = renderComposer(onSend, { replyTarget: reply, replyQuote: "original" });
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    rerenderComposer(props);
    pressEnter(textarea);
    await act(async () => {});
    expect(onSend.mock.calls[1]?.[2]).not.toBe(onSend.mock.calls[0]?.[2]);
  });

  it.each(replyChanges)("does not restore after a $name while sending", async ({ props }) => {
    let finishSend = (_sent: boolean) => {};
    const textarea = renderComposer(
      () =>
        new Promise<boolean>((resolve) => {
          finishSend = resolve;
        }),
      { replyTarget: reply, replyQuote: "original" },
    );
    type(textarea, "hello");
    pressEnter(textarea);
    rerenderComposer(props);
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("");
  });

  it("preserves the retry nonce when the reply object refreshes without changing its ID or quote", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    const textarea = renderComposer(onSend, { replyTarget: reply, replyQuote: "original" });
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    rerenderComposer({ replyTarget: { ...reply } });
    pressEnter(textarea);
    await act(async () => {});
    expect(onSend.mock.calls[1]?.[2]).toBe(onSend.mock.calls[0]?.[2]);
  });

  it("uses a fresh nonce for another message after a successful retry", async () => {
    const onSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const textarea = renderComposer(onSend);
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    pressEnter(textarea);
    await act(async () => {});
    type(textarea, "hello");
    pressEnter(textarea);
    await act(async () => {});
    expect(onSend.mock.calls[1]?.[2]).toBe(onSend.mock.calls[0]?.[2]);
    expect(onSend.mock.calls[2]?.[2]).not.toBe(onSend.mock.calls[0]?.[2]);
  });
});

function transcriptProps() {
  const scrollRef = createRef<HTMLDivElement>();
  const noop = () => {};
  return {
    scrollRef,
    sentHere: { current: false },
    onScrollRequestHandled: noop,
    artifactTarget: { botId: "bot-1" },
    showToolActivity: false,
    olderCursor: null,
    loadingOlder: false,
    answerableAskMessageId: null,
    running: false,
    workingBots: [],
    onLoadOlder: noop,
    onOpenBot: noop,
    onAnswer: async () => {},
    onReply: noop,
    onQuote: noop,
    onReact: async () => {},
    onJumpToMessage: noop,
    onOpenPeerMessages: noop,
    peerBot: () => undefined,
    onRefresh: async () => {},
    onBotChanged: async () => {},
    onAddRoutine: noop,
    voiceReady: false,
    speakingMessageId: null,
    onSpeak: noop,
    onOpenComputer: noop,
  } as unknown as ComponentProps<typeof Transcript>;
}

describe("Transcript jump to a search result", () => {
  const msg = (id: string, seq: number): ThreadMessage => ({
    id,
    threadId: "t1",
    seq,
    role: "bot",
    blocks: [{ kind: "text", text: `message ${id}` }],
    createdAt: "2026-10-01T00:00:00.000Z",
  });

  it("does not snap to the end when older messages mount for the jump", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia ??= (query: string) =>
      ({
        matches: !query.includes("pointer"),
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList;
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.animate = vi.fn() as never;
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo as never;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const props = transcriptProps();
    const render = (
      messages: ThreadMessage[],
      scrollRequest: { messageId: string; nonce: number } | null,
    ) =>
      act(() =>
        root?.render(<Transcript {...props} messages={messages} scrollRequest={scrollRequest} />),
      );

    // The reader sits at the end of the newest page.
    render([msg("m10", 10), msg("m11", 11)], null);
    scrollTo.mockClear();
    // A search hit loads an older window around m3 and asks to scroll to it.
    render([msg("m3", 3), msg("m4", 4), msg("m10", 10), msg("m11", 11)], {
      messageId: "m3",
      nonce: 1,
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();

    // A handoff shows who handed off to whom, never the bot-to-bot prompt.
    render(
      [
        {
          ...msg("m12", 12),
          blocks: [
            {
              kind: "handoff",
              fromBotId: "bot-1",
              toBotId: "bot-2",
              text: "INTERNAL: summarize contract status for the user",
            } as never,
          ],
        },
      ],
      null,
    );
    expect(container?.textContent).toContain("handed off to");
    expect(container?.textContent).not.toContain("INTERNAL: summarize");
  });
  it("keeps the newest message in view when the layout grows while following", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia ??= (query: string) =>
      ({
        matches: !query.includes("pointer"),
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList;
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn() as never;
    let resized: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const scrollRef = createRef<HTMLDivElement>();
    const noop = () => {};
    const props = {
      scrollRef,
      sentHere: { current: false },
      onScrollRequestHandled: noop,
      artifactTarget: { botId: "bot-1" },
      showToolActivity: false,
      olderCursor: null,
      loadingOlder: false,
      answerableAskMessageId: null,
      running: false,
      workingBots: [],
      onLoadOlder: noop,
      onOpenBot: noop,
      onAnswer: async () => {},
      onReply: noop,
      onQuote: noop,
      onReact: async () => {},
      onJumpToMessage: noop,
      onOpenPeerMessages: noop,
      peerBot: () => undefined,
      onRefresh: async () => {},
      onBotChanged: async () => {},
      onAddRoutine: noop,
      voiceReady: false,
      speakingMessageId: null,
      onSpeak: noop,
      onOpenComputer: noop,
    } as unknown as ComponentProps<typeof Transcript>;
    act(() =>
      root?.render(<Transcript {...props} messages={[msg("m1", 1)]} scrollRequest={null} />),
    );
    const element = scrollRef.current;
    if (!element) throw new Error("no transcript");
    // A phone rotation rewraps the bubbles: the content is now taller than the view.
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: 800 });
    Object.defineProperty(element, "clientHeight", { configurable: true, value: 600 });
    element.scrollTop = 0;
    act(() => resized?.());
    expect(element.scrollTop).toBe(800);
    vi.unstubAllGlobals();
  });
});

describe("Transcript failed-run note", () => {
  it("names a failed routine run as scheduled, so a thread with no question explains itself", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn() as never;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const note = () => container?.querySelector('[data-testid="transcript-failed-note"]');
    const render = (failedScheduled: boolean) =>
      act(() =>
        root?.render(
          <Transcript
            {...transcriptProps()}
            messages={[]}
            scrollRequest={null}
            failedNote="Key rejected."
            failedScheduled={failedScheduled}
          />,
        ),
      );
    render(true);
    expect(note()?.textContent).toBe("Scheduled run failed: Key rejected.");
    render(false);
    expect(note()?.textContent).toBe("Last run failed: Key rejected.");
  });
});

describe("Transcript Remember action", () => {
  const msg = (id: string, seq: number, role: "user" | "bot"): ThreadMessage => ({
    id,
    threadId: "t1",
    seq,
    role,
    blocks: [{ kind: "text", text: `message ${id}` }],
    createdAt: "2026-10-01T00:00:00.000Z",
  });

  it("offers Remember on agent messages only and shows the saved state", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn() as never;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const onRemember = vi.fn();
    act(() =>
      root?.render(
        <Transcript
          {...transcriptProps()}
          messages={[msg("u1", 1, "user"), msg("b1", 2, "bot"), msg("b2", 3, "bot")]}
          scrollRequest={null}
          remember={{ ids: new Set(["b2"]), onRemember }}
        />,
      ),
    );
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Remember"], [aria-label="Remembered"]',
    );
    expect([...buttons].map((button) => button.getAttribute("aria-label"))).toEqual([
      "Remember",
      "Remembered",
    ]);
    expect(buttons[1]?.disabled).toBe(true);
    act(() => buttons[0]?.click());
    expect(onRemember).toHaveBeenCalledWith("b1");
  });
});

describe("Transcript unread divider and new-message pill", () => {
  const msg = (seq: number, role: "bot" | "user" = "bot"): ThreadMessage => ({
    id: `m${seq}`,
    threadId: "t1",
    seq,
    role,
    blocks: [{ kind: "text", text: `message ${seq}` }],
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  // seq 0 bot, 1 user, 2 bot, 3 user, 4 bot
  const thread = [msg(0), msg(1, "user"), msg(2), msg(3, "user"), msg(4)];

  function mount() {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia ??= (query: string) =>
      ({
        matches: !query.includes("pointer"),
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList;
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn() as never;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const props = transcriptProps();
    const render = (messages: ThreadMessage[], extra: Partial<ComponentProps<typeof Transcript>>) =>
      act(() =>
        root?.render(<Transcript {...props} messages={messages} scrollRequest={null} {...extra} />),
      );
    return { props, render };
  }
  const dividers = () => [...(container?.querySelectorAll('[data-testid="unread-divider"]') ?? [])];
  const followingRow = (divider: Element) =>
    (divider.nextElementSibling as HTMLElement | null)?.dataset.messageId;

  it("goes before the first unread message from the other party, never the user's own", () => {
    const { render } = mount();
    render(thread, { lastReadSeq: 1 });
    expect(dividers()).toHaveLength(1);
    expect(followingRow(dividers()[0]!)).toBe("m2");
    expect(dividers()[0]?.textContent).toBe("New");
  });

  it("is absent when everything is read or only the user's own messages are newer", () => {
    const { render } = mount();
    render(thread, { lastReadSeq: 4 });
    expect(dividers()).toHaveLength(0);
    render([msg(0), msg(1, "user")], { lastReadSeq: 0 });
    expect(dividers()).toHaveLength(0);
  });

  it("stays put as messages arrive and are marked read, and clears after the reader sends", () => {
    const { render } = mount();
    render(thread, { lastReadSeq: 1 });
    render([...thread, msg(5)], { lastReadSeq: 5 });
    expect(dividers()).toHaveLength(1);
    expect(followingRow(dividers()[0]!)).toBe("m2");
    render([...thread, msg(5), msg(6, "user")], { lastReadSeq: 5 });
    expect(dividers()).toHaveLength(0);
  });

  describe("scrolled up", () => {
    const scrollUp = () => {
      const element = container?.querySelector<HTMLElement>('[data-testid="transcript"]');
      if (!element) throw new Error("no transcript");
      for (const [key, value] of [
        ["scrollHeight", 2000],
        ["clientHeight", 500],
        ["scrollTop", 0],
      ] as const) {
        Object.defineProperty(element, key, { value, configurable: true, writable: true });
      }
      act(() => {
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
    };
    const pill = () => container?.querySelector('[data-testid="new-messages-count"]')?.textContent;
    const jump = () =>
      [...(container?.querySelectorAll("button") ?? [])].find((b) =>
        /Jump to latest|new message/.test(b.textContent ?? ""),
      );

    it("counts new messages from the other party and dismisses the count", () => {
      const { render } = mount();
      render(thread, { lastReadSeq: 4 });
      scrollUp();
      expect(pill()).toBeUndefined();
      expect(jump()?.textContent).toBe("Jump to latest");
      render([...thread, msg(5)], { lastReadSeq: 4 });
      expect(pill()).toBe("1 new message");
      render([...thread, msg(5), msg(6, "user"), msg(7)], { lastReadSeq: 4 });
      expect(pill()).toBe("2 new messages");
      const dismiss = container?.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
      act(() => dismiss?.click());
      expect(pill()).toBeUndefined();
      expect(jump()?.textContent).toBe("Jump to latest");
      render([...thread, msg(5), msg(6, "user"), msg(7), msg(8)], { lastReadSeq: 4 });
      expect(pill()).toBe("3 new messages");
    });
  });

  describe("pill count with live rows", () => {
    const live = (seq: number, role: "bot" | "user" = "bot") => ({
      ...msg(seq, role),
      seq: 900 + seq * 7,
    });
    const element = () => container?.querySelector<HTMLElement>('[data-testid="transcript"]');
    const scrollUp = () => {
      const el = element();
      if (!el) throw new Error("no transcript");
      for (const [key, value] of [
        ["scrollHeight", 2000],
        ["clientHeight", 500],
        ["scrollTop", 0],
      ] as const) {
        Object.defineProperty(el, key, { value, configurable: true, writable: true });
      }
      act(() => {
        el.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
    };
    const pill = () => container?.querySelector('[data-testid="new-messages-count"]')?.textContent;

    it("does not count an old row rewritten in place, nor a refresh that renumbers rows", () => {
      const { render } = mount();
      const rows = thread;
      render(rows, { lastReadSeq: 4 });
      scrollUp();
      // thread.message.updated rewrites an old row with the event's (larger) seq.
      render(
        rows.map((m) => (m.id === "m2" ? { ...m, seq: 5000 } : m)),
        { lastReadSeq: 4 },
      );
      expect(pill()).toBeUndefined();
      // A refresh brings the stored seqs back.
      render(thread, { lastReadSeq: 4 });
      expect(pill()).toBeUndefined();
      render([...thread, live(5)], { lastReadSeq: 4 });
      expect(pill()).toBe("1 new message");
    });
  });

  describe("opening on unread messages", () => {
    // The usual snap to the end leaves the divider 500 px above the top of the scroller.
    const openedScrollTop = (extra: Partial<ComponentProps<typeof Transcript>>) => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        cb(0);
        return 1;
      });
      const { render } = mount();
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        return (
          this.hasAttribute("data-unread-divider")
            ? { top: -500, bottom: -480 }
            : { top: 0, bottom: 300 }
        ) as DOMRect;
      };
      try {
        render(thread, { lastReadSeq: 1, ...extra });
      } finally {
        Element.prototype.getBoundingClientRect = original;
      }
      return container?.querySelector<HTMLElement>('[data-testid="transcript"]')?.scrollTop;
    };
    afterEach(() => vi.restoreAllMocks());

    it("scrolls to the divider in the user's own thread", () => {
      expect(openedScrollTop({})).toBeLessThan(0);
    });

    it("stays at the end in a docked page-agent panel", () => {
      expect(openedScrollTop({ anchorToUnread: false })).toBe(0);
    });
  });

  describe("marking read", () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("reports the newest message once, after a debounce, while the tab is attended", () => {
      vi.useFakeTimers();
      vi.spyOn(document, "hasFocus").mockReturnValue(true);
      const onRead = vi.fn().mockResolvedValue(undefined);
      const { render } = mount();
      render(thread, { lastReadSeq: 1, onRead });
      expect(onRead).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(20);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onRead).toHaveBeenCalledTimes(1);
      expect(onRead).toHaveBeenCalledWith("m4", true);
    });

    // Rows built from SSE events carry event seqs, far from the stored Message.seq.
    const liveThread = thread.map((m, i) => ({ ...m, seq: 900 + i * 7 }));

    it("names the last visible message, not the newest, when scrolled up on live rows", () => {
      vi.useFakeTimers();
      vi.spyOn(document, "hasFocus").mockReturnValue(true);
      const onRead = vi.fn().mockResolvedValue(undefined);
      const { render } = mount();
      render(liveThread, { onRead });
      const element = container?.querySelector<HTMLElement>('[data-testid="transcript"]');
      if (!element) throw new Error("no transcript");
      for (const [key, value] of [
        ["scrollHeight", 2000],
        ["clientHeight", 300],
        ["scrollTop", 0],
      ] as const) {
        Object.defineProperty(element, key, { value, configurable: true, writable: true });
      }
      element.getBoundingClientRect = () => ({ bottom: 300, top: 0 }) as DOMRect;
      container?.querySelectorAll<HTMLElement>("[data-message-id]").forEach((row, i) => {
        row.getBoundingClientRect = () => ({ top: i * 100, bottom: i * 100 + 90 }) as DOMRect;
      });
      onRead.mockClear();
      act(() => {
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      // Rows 0 to 2 are on screen (the row at 300 is below the fold): m2, never the newest m4.
      expect(onRead).toHaveBeenLastCalledWith("m2", false);
      expect(onRead).not.toHaveBeenCalledWith("m4", expect.anything());
    });

    it("sends nothing for an earlier row after a later one was reported", () => {
      vi.useFakeTimers();
      vi.spyOn(document, "hasFocus").mockReturnValue(true);
      const onRead = vi.fn().mockResolvedValue(undefined);
      const { render } = mount();
      render(liveThread, { onRead });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(onRead).toHaveBeenCalledTimes(1);
      // A refresh replaces the live rows with stored ones (different seqs, same ids).
      render(thread, { onRead });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(onRead).toHaveBeenCalledTimes(1);
    });

    it("does not write while the tab is unfocused", () => {
      vi.useFakeTimers();
      vi.spyOn(document, "hasFocus").mockReturnValue(false);
      const onRead = vi.fn().mockResolvedValue(undefined);
      const { render } = mount();
      render(thread, { lastReadSeq: 1, onRead });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onRead).not.toHaveBeenCalled();
    });
  });
});

describe("chatIsOpening", () => {
  const open = { hasChat: false, botsLoaded: false, routeWaiting: false };
  it("is true while the bot list loads or the route bot is not in it yet", () => {
    expect(chatIsOpening(open)).toBe(true);
    expect(chatIsOpening({ ...open, botsLoaded: true, routeWaiting: true })).toBe(true);
  });
  it("is false once a chat is open or the list loaded with nothing to wait for", () => {
    expect(chatIsOpening({ ...open, hasChat: true })).toBe(false);
    expect(chatIsOpening({ ...open, botsLoaded: true })).toBe(false);
  });
});

describe("sidebar list refresh", () => {
  it("polls spaces.list at most every 30 s (it ran every 3 s: about 96 calls in 5 minutes)", () => {
    expect(BOTS_POLL_MS).toBeGreaterThanOrEqual(30_000);
  });
});

describe("retryAfterStop", () => {
  it("resends after a successful stop in the same chat", async () => {
    const resend = vi.fn();
    await retryAfterStop({ stop: async () => true, destination: () => "bot-1", resend });
    expect(resend).toHaveBeenCalledTimes(1);
  });

  it("does not resend when the stop failed", async () => {
    const resend = vi.fn();
    await retryAfterStop({ stop: async () => false, destination: () => "bot-1", resend });
    expect(resend).not.toHaveBeenCalled();
  });

  it("does not resend into another chat when the person navigated during the stop", async () => {
    const resend = vi.fn();
    let current = "bot-1";
    await retryAfterStop({
      stop: async () => {
        current = "group-9";
        return true;
      },
      destination: () => current,
      resend,
    });
    expect(resend).not.toHaveBeenCalled();
  });
});

describe("search result details", () => {
  it("mask currency amounts while amounts are hidden", async () => {
    setHideAmounts(true);
    const { documents, artifacts } = await findDocumentsAndArtifacts("a");
    expect(documents[0]?.detail).not.toContain("1,250");
    expect(artifacts[0]?.detail).not.toContain("9,900");
  });
});

describe("palette lookups", () => {
  beforeEach(() => {
    paletteRpc.folders = 0;
    paletteRpc.contacts = 0;
    paletteRpc.foldersFail = false;
    paletteRpc.contactsFail = false;
    paletteRpc.listSpace = [];
  });

  it("Cmd+K fetches contacts and Data room folders once while typing several queries", async () => {
    // Opening the palette keeps what it loads next to the open state, for the searches that follow.
    const lookups = createPaletteLookupCache();
    for (const query of ["de", "dea", "deal"]) await findDocumentsAndArtifacts(query, lookups);
    for (const query of ["ha", "hal", "halcyon"]) await findContacts(query, lookups);
    expect(paletteRpc.folders).toBe(1);
    expect(paletteRpc.contacts).toBe(1);
    // Opening it again starts a fresh load, so a contact added since shows up.
    expect((await findContacts("halcyon", createPaletteLookupCache())).length).toBe(1);
    expect(paletteRpc.contacts).toBe(2);
  });

  it("lets the server find artifacts by the query, one more than it lists", async () => {
    const { artifacts } = await findDocumentsAndArtifacts("report", createPaletteLookupCache());
    expect(paletteRpc.listSpace).toEqual([{ q: "report", limit: 6 }]);
    expect(artifacts.map((item) => item.label)).toEqual(["Report"]);
  });

  it("retries a failed lookup on the next open", async () => {
    const lookups = createPaletteLookupCache();
    paletteRpc.contactsFail = true;
    expect(await findContacts("hal", lookups)).toEqual([]);
    paletteRpc.contactsFail = false;
    expect((await findContacts("hal", lookups)).length).toBe(1);
    expect(paletteRpc.contacts).toBe(2);
  });
});

describe("isRoutinesOnlyPanel", () => {
  it("hides the computer block without a screen, whatever the computer state", () => {
    const base = { hasScreen: false, hasError: false, open: false, showRecoveryHint: false };
    expect(isRoutinesOnlyPanel({ ...base, kind: undefined })).toBe(true);
    expect(isRoutinesOnlyPanel({ ...base, kind: "desktop" })).toBe(false);
    const withScreen = { ...base, kind: undefined, hasScreen: true };
    expect(isRoutinesOnlyPanel({ ...withScreen, state: "running" })).toBe(false);
    expect(isRoutinesOnlyPanel({ ...withScreen, state: "stopped" })).toBe(true);
    expect(isRoutinesOnlyPanel({ ...withScreen, state: "suspended" })).toBe(false);
    expect(isRoutinesOnlyPanel({ ...base, kind: undefined, hasError: true })).toBe(false);
  });
});

describe("showsComputerCaption", () => {
  it("names the computer only above a live screen", () => {
    const live = {
      kind: undefined,
      state: "running" as const,
      screenLoaded: true,
      hasError: false,
      open: false,
    };
    expect(showsComputerCaption(live)).toBe(true);
    expect(showsComputerCaption({ ...live, state: "suspended" })).toBe(false);
    expect(showsComputerCaption({ ...live, screenLoaded: false })).toBe(false);
    expect(showsComputerCaption({ ...live, open: true })).toBe(false);
    expect(showsComputerCaption({ ...live, hasError: true })).toBe(false);
    expect(showsComputerCaption({ ...live, kind: "desktop" })).toBe(false);
  });
});

describe("findChats", () => {
  const hit = (extra: Record<string, unknown>) => ({
    kind: "message",
    snippet: "",
    title: "",
    createdAt: null,
    ...extra,
  });

  it("lists a routine apart from chats, so it does not hide that bot's message hit", async () => {
    searchHits.current = [
      hit({
        kind: "routine",
        botId: "b1",
        botName: "Finance agent",
        routineId: "r1",
        title: "Monday receipt chase",
      }),
      hit({ botId: "b1", botName: "Finance agent", messageId: "m1", snippet: "receipt sent" }),
    ];
    const { chats, routines } = await findChats("receipt");
    expect(routines).toEqual([
      { id: "/app/b1?routine=r1", label: "Monday receipt chase", detail: "Finance agent" },
    ]);
    expect(chats.map((c) => c.id)).toContain("/app/b1?m=m1");
  });

  it("drops groups and bots matched only by description, and keeps bots matched by name", async () => {
    searchHits.current = [
      hit({ kind: "conversation", botId: "b2", botName: "Inbox agent", snippet: "tracks finance" }),
      hit({ kind: "conversation", groupId: "g1", groupName: "Fin team", snippet: "" }),
      hit({ kind: "conversation", botId: "b3", botName: "Fin thread", snippet: "" }),
    ];
    const { chats } = await findChats("fin");
    expect(chats.map((c) => c.label)).toEqual(["Fin thread"]);
  });
});

describe("answerThenRefresh", () => {
  it("does not fail a committed answer when the refresh fails", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(answerThenRefresh({ answer: async () => undefined, refresh })).resolves.toBe(
      undefined,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes once in the background and rethrows when the answer fails", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("offline"));
    const failure = new Error("CONFLICT");
    await expect(
      answerThenRefresh({
        answer: async () => {
          throw failure;
        },
        refresh,
      }),
    ).rejects.toBe(failure);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("useScratchpadFocus", () => {
  function Harness({ events }: { events: unknown[] }) {
    const focus = useScratchpadFocus();
    events.push(focus.focus);
    return (
      <>
        <button type="button" onClick={() => focus.request("bot-1", "s2")}>
          request
        </button>
        <button type="button" onClick={() => focus.consume()}>
          consume
        </button>
      </>
    );
  }

  it("clears a request once it is consumed, so a later open does not replay it", async () => {
    const events: unknown[] = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<Harness events={events} />));
      await act(async () => {
        container.querySelector<HTMLButtonElement>("button")?.click();
      });
      expect(events.at(-1)).toMatchObject({ botId: "bot-1", itemId: "s2" });
      await act(async () => {
        container.querySelectorAll<HTMLButtonElement>("button")[1]?.click();
      });
      expect(events.at(-1)).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});

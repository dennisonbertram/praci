// @vitest-environment jsdom

import type { AgentSkillCatalogEntry, ThreadMessage } from "@rakazo/contracts";
import type { ComposerMention } from "@rakazo/core";
import type { ComponentProps, ReactNode } from "react";
import { act, createRef } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ msg: (parts: TemplateStringsArray) => parts[0] }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});

import { setHideAmounts } from "../lib/hide-amounts-preference";
import { Composer, Transcript } from "./Shell";

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
  window.matchMedia ??= () =>
    ({
      matches: true,
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
  it("shows Voice and Stop while a run goes on with nothing typed, and Send and Stop once there is", () => {
    const textarea = renderComposer(async () => true, { running: true, onVoice: () => {} });
    const labels = () =>
      [...(container?.querySelectorAll("button[aria-label]") ?? [])]
        .map((b) => b.getAttribute("aria-label"))
        .filter((label) => label === "Voice" || label === "Send" || label === "Stop");
    expect(labels()).toEqual(["Voice", "Stop"]);
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
      expect(chips()).toEqual(["Research Writer"]);
    });

    it("follows the highlighted option when an option is inserted before it", () => {
      const textarea = openOnWriter([researcher, writer]);
      rerenderComposer({ mentionTargets: [routine, researcher, writer] });
      expect(selected()).toContain("Research Writer");
      pressKey(textarea, "Enter");
      expect(chips()).toEqual(["Research Writer"]);
    });

    it("keeps the default highlight on the first option when an option is inserted before it", () => {
      const textarea = renderComposer(vi.fn(), { mentionTargets: [researcher, writer] });
      type(textarea, "@Res");
      expect(selected()).toContain("Researcher");
      rerenderComposer({ mentionTargets: [routine, researcher, writer] });
      expect(selected()).toContain("Researcher");
      pressKey(textarea, "Enter");
      expect(chips()).toEqual(["Researcher"]);
    });

    it("falls back to the first option when the highlighted option disappears", () => {
      const textarea = openOnWriter([researcher, writer]);
      rerenderComposer({ mentionTargets: [researcher] });
      expect(selected()).toContain("Researcher");
      pressKey(textarea, "Enter");
      expect(chips()).toEqual(["Researcher"]);
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
      expect(textarea.getAttribute("aria-expanded")).toBe("true");
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
    type(textarea, "hello");
    pressEnter(textarea);
    expect(onSend).toHaveBeenCalledWith("@Bob hello", [bob], expect.any(String));
    expect(textarea.value).toBe("");
    expect(mentionChips()).toEqual([]);
    await act(async () => finishSend(false));
    expect(textarea.value).toBe("hello");
    expect(mentionChips()).toEqual(["Bob"]);
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
    window.matchMedia ??= () =>
      ({
        matches: true,
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

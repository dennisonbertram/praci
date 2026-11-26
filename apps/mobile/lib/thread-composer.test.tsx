// @vitest-environment jsdom

import { resolveComposerSendPlan } from "@rakazo/core";
import type { ComponentProps, ReactNode } from "react";
import { act, createElement, createRef } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadComposerHandle } from "../components/thread-composer";
import { ThreadComposer } from "../components/thread-composer";
import { settleComposer } from "./thread-feedback";

const input = vi.hoisted(() => ({
  change: (_value: string) => {},
  key: (_event: { nativeEvent: { key: string } }) => {},
  select: (_selection: { start: number; end: number }) => {},
  setSelection: vi.fn((_start: number, _end: number) => {}),
}));
vi.mock("react-native", () => {
  const Surface = ({ children, testID }: { children?: ReactNode; testID?: string }) =>
    createElement("div", { "data-testid": testID }, children);
  return {
    View: Surface,
    ScrollView: Surface,
    Text: Surface,
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
      disabled,
    }: {
      children?: ReactNode;
      onPress: () => void;
      accessibilityLabel: string;
      disabled?: boolean;
    }) =>
      createElement(
        "button",
        { type: "button", onClick: onPress, "aria-label": accessibilityLabel, disabled },
        children,
      ),
    TextInput: ({
      value,
      onChangeText,
      onKeyPress,
      onSelectionChange,
      ref,
    }: {
      value: string;
      onChangeText: typeof input.change;
      onKeyPress: typeof input.key;
      onSelectionChange: (event: {
        nativeEvent: { selection: { start: number; end: number } };
      }) => void;
      ref?: { current: { setSelection: typeof input.setSelection } | null };
    }) => {
      input.change = onChangeText;
      input.key = onKeyPress;
      input.select = (selection) => onSelectionChange({ nativeEvent: { selection } });
      if (ref) ref.current = { setSelection: input.setSelection };
      return createElement("input", { value, readOnly: true });
    },
  };
});
vi.mock("@expo/ui/community/menu", () => ({
  MenuView: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("../components/glass-surface", () => ({
  GlassSurface: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("./native", () => ({ useMobileTokens: () => ({}), useResolvedAppearance: () => "light" }));
vi.mock("./i18n", () => ({ useI18n: () => ({ t: (text: string) => text }) }));

const skill = {
  id: "skill-1",
  name: "Writing",
  description: "Write",
  source: "user",
  readOnly: false,
} as const;
const bot = { kind: "bot", id: "bot-2", name: "Helper" } as const;
const props: Omit<ComponentProps<typeof ThreadComposer>, "ref"> = {
  agentSkills: [skill],
  composerMentionTargets: [bot],
  composerPrompt: "Message…",
  replyQuote: null,
  attachmentIds: [],
  botId: "bot-1",
  onCall: false,
  working: false,
  sending: false,
  styles: { circleButton: {}, composerFill: {} },
  attachActions: [],
  attachFrom: vi.fn(),
  send: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  startVoiceCall: vi.fn(async () => {}),
  onSlashAction: vi.fn(),
};

describe("thread composer isolation", () => {
  let root: Root;
  let container: HTMLDivElement;
  let threadRenders: number;
  const composer = createRef<ThreadComposerHandle>();
  function ThreadHarness({
    threadKey = "bot-1",
    ...changes
  }: Partial<typeof props> & { threadKey?: string }) {
    threadRenders += 1;
    return <ThreadComposer key={threadKey} ref={composer} {...props} {...changes} />;
  }
  function render(changes: Partial<typeof props> & { threadKey?: string } = {}) {
    act(() => root.render(<ThreadHarness {...changes} />));
  }
  function type(value: string) {
    act(() => input.change(value));
  }
  function select(start: number, end = start) {
    act(() => input.select({ start, end }));
  }
  function press(label: string) {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    expect(button).not.toBeNull();
    act(() => button.click());
  }
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    // The composer moves the caret on the next frame; run it now so a pick is observable.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.clearAllMocks();
    threadRenders = 0;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    render();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("types 20 characters without rendering the parent and sends the latest ref snapshot", () => {
    const mounted = threadRenders;
    const text = "abcdefghijklmnopqrst";
    for (let length = 1; length <= text.length; length += 1) type(text.slice(0, length));
    expect(threadRenders - mounted).toBe(0);
    expect(container.querySelector("input")!.value).toBe(text);
    expect(composer.current!.snapshot().promptText).toBe(text);
    press("Send");
    expect(props.send).toHaveBeenCalledOnce();
  });

  it("preserves draft across reply, attachment, and sending updates and resets on thread switch", () => {
    type("Draft");
    render({
      replyTargetId: "reply-1",
      replyQuote: "Quote",
      attachmentIds: ["attachment-1"],
      sending: true,
    });
    expect(composer.current!.snapshot()).toMatchObject({
      promptText: "Draft",
      replyTargetId: "reply-1",
      replyQuote: "Quote",
      attachmentIds: ["attachment-1"],
    });
    render({ threadKey: "bot-2" });
    expect(composer.current!.snapshot()).toMatchObject({
      promptText: "",
      mentions: [],
      skill: null,
    });
    expect(container.querySelector("input")!.value).toBe("");
  });

  it("keeps edits during send and clears an unchanged composition, including popovers", () => {
    type("Submitted");
    const submitted = composer.current!.snapshot();
    render({ sending: true });
    type("Dictated replacement @He");
    expect(container.querySelector('[data-testid="mention-picker"]')).not.toBeNull();
    expect(settleComposer(submitted, composer.current!.snapshot()).clearComposer).toBe(false);
    const current = composer.current!.snapshot();
    expect(settleComposer(current, composer.current!.snapshot()).clearComposer).toBe(true);
    act(() => composer.current!.reset());
    expect(composer.current!.snapshot().promptText).toBe("");
    expect(container.querySelector('[data-testid="mention-picker"]')).toBeNull();
  });

  it("offers Goal in a bot chat and inserts the command instead of dispatching it", () => {
    type("/");
    press("Goal");
    expect(props.onSlashAction).not.toHaveBeenCalled();
    expect(composer.current!.snapshot().promptText).toBe("/goal");
    expect(container.querySelector("input")!.value).toBe("/goal ");
  });

  it("hides Goal in a group chat and still dispatches the settings actions", () => {
    render({ botId: undefined });
    type("/");
    expect(container.querySelector('button[aria-label="Goal"]')).toBeNull();
    press("Settings");
    expect(props.onSlashAction).toHaveBeenCalledWith("chat-settings");
  });

  it("ranks prefix, word-start and substring mention matches ahead of kind order", () => {
    render({
      composerMentionTargets: [
        { kind: "bot", id: "b1", name: "Outmailer" },
        { kind: "group", id: "g1", name: "Team Mail" },
        { kind: "connector", id: "c1", name: "Mailchimp" },
      ],
    });
    type("@mail");
    const text = container.querySelector('[data-testid="mention-picker"]')!.textContent!;
    expect(text.indexOf("Mailchimp")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Mailchimp")).toBeLessThan(text.indexOf("Team Mail"));
    expect(text.indexOf("Team Mail")).toBeLessThan(text.indexOf("Outmailer"));
  });

  it("ranks before the ten-item cap so a later-kind prefix match is not cut", () => {
    render({
      composerMentionTargets: [
        ...Array.from({ length: 10 }, (_, i) => ({
          kind: "bot" as const,
          id: `b${i}`,
          name: `Xmailer ${i}`,
        })),
        { kind: "connector", id: "c1", name: "Mailchimp" },
      ],
    });
    type("@mail");
    expect(container.querySelector('[data-testid="mention-picker"]')!.textContent).toContain(
      "Mailchimp",
    );
  });

  it("selects mention and skill popovers, keeping the mention inline", () => {
    type("Hello @He");
    press("@{name}");
    expect(composer.current!.snapshot().mentions).toEqual([bot]);
    expect(container.querySelector("input")!.value).toBe("Hello @Helper ");
    expect(container.querySelector('[data-testid="mention-picker"]')).toBeNull();
    type("/Wri");
    press("Skill {name}");
    expect(composer.current!.snapshot().skill).toEqual(skill);
    expect(container.querySelector("input")!.value).toBe("");
    expect(container.querySelector('[data-testid="slash-picker"]')).toBeNull();
    // Backspace on an empty draft removes only the skill chip; a mention lives in the text, not beside it.
    act(() => input.key({ nativeEvent: { key: "Backspace" } }));
    expect(composer.current!.snapshot().mentions).toEqual([]);
    expect(composer.current!.snapshot().skill).toBeNull();
  });

  it("puts a picked mention where it was typed and sends it once", () => {
    render({
      composerMentionTargets: [
        { kind: "bot", id: "bot-investors", name: "Investors" },
        { kind: "bot", id: "bot-ops", name: "Ops" },
      ],
    });
    type("share with @Inv");
    press("@{name}");
    expect(container.querySelector("input")!.value).toBe("share with @Investors ");
    expect(composer.current!.snapshot().promptText).toBe("share with @Investors");
    expect(composer.current!.snapshot().mentions).toEqual([
      { kind: "bot", id: "bot-investors", name: "Investors" },
    ]);
    expect(input.setSelection).toHaveBeenLastCalledWith(22, 22);
    type("share with @Investors and you");
    expect(composer.current!.snapshot().promptText).toBe("share with @Investors and you");
    expect(composer.current!.snapshot().mentions).toHaveLength(1);
  });

  it("replaces an @query in the middle of a draft", () => {
    type("hi  there");
    select(3);
    type("hi @He there");
    select(6);
    press("@{name}");
    expect(container.querySelector("input")!.value).toBe("hi @Helper there");
    expect(composer.current!.snapshot().promptText).toBe("hi @Helper there");
    expect(composer.current!.snapshot().mentions).toEqual([bot]);
    expect(input.setSelection).toHaveBeenLastCalledWith(10, 10);
  });

  it("ignores a stale zero selection while the picker is open", () => {
    type("hi @He");
    select(0);
    press("@{name}");
    expect(container.querySelector("input")!.value).toBe("hi @Helper ");
    expect(composer.current!.snapshot().promptText).toBe("hi @Helper");
  });

  it("un-mentions a token that is edited", () => {
    type("hi @He");
    press("@{name}");
    expect(composer.current!.snapshot().mentions).toEqual([bot]);
    type("hi @Helpe ");
    expect(composer.current!.snapshot().mentions).toEqual([]);
    expect(container.querySelector('[data-testid="mention-chip"]')).toBeNull();
    expect(container.querySelector("input")!.value).toBe("hi @Helpe ");
  });

  it("removes one mention's token and spaces from the chip row", () => {
    render({
      composerMentionTargets: [bot, { kind: "bot", id: "bot-ops", name: "Ops" }],
    });
    type("@He");
    press("@{name}");
    type("@Helper ask @Ops");
    press("@{name}");
    type("@Helper ask @Ops now");
    expect(composer.current!.snapshot().mentions).toHaveLength(2);
    press("Remove mention {name}");
    expect(container.querySelector("input")!.value).toBe("ask @Ops now");
    expect(composer.current!.snapshot().mentions).toEqual([
      { kind: "bot", id: "bot-ops", name: "Ops" },
    ]);
    expect(composer.current!.snapshot().promptText).toBe("ask @Ops now");
  });

  it("keeps a group mention inline so the send plan still reroutes", () => {
    const group = { kind: "group", id: "g1", name: "Team Mail" } as const;
    render({ composerMentionTargets: [group] });
    type("@Tea");
    press("@{name}");
    const snapshot = composer.current!.snapshot();
    expect(snapshot.promptText).toBe("@Team Mail");
    const plan = resolveComposerSendPlan({
      text: snapshot.promptText,
      mentions: snapshot.mentions,
      hasAttachments: false,
    });
    expect(plan.rerouteGroupId).toBe("g1");
    expect(plan.isNoOp).toBe(false);
  });

  it("combines a picked skill with a mention typed after it", () => {
    type("/Wri");
    press("Skill {name}");
    type("draft for @He");
    press("@{name}");
    // The picker's trailing space sits in the body, as it does on web.
    expect(composer.current!.snapshot().promptText).toBe("/Writing\ndraft for @Helper ");
  });

  it("keeps the mention when text is added before it", () => {
    type("hi @He");
    press("@{name}");
    expect(composer.current!.snapshot().mentions).toEqual([bot]);
    type("xhi @Helper ");
    expect(container.querySelector("input")!.value).toBe("xhi @Helper ");
    expect(composer.current!.snapshot().mentions).toEqual([bot]);
    expect(composer.current!.snapshot().promptText).toBe("xhi @Helper");
  });

  it("removes both chips when the text was picked out of order", () => {
    type("end @He");
    press("@{name}");
    type("end @Helper with notes after");
    type("@Heend @Helper with notes after");
    select(3);
    press("@{name}");
    expect(container.querySelector("input")!.value).toBe("@Helper end @Helper with notes after");
    expect(composer.current!.snapshot().mentions).toHaveLength(1);
    press("Remove mention {name}");
    expect(container.querySelector("input")!.value).toBe("end with notes after");
    expect(composer.current!.snapshot().mentions).toEqual([]);
  });

  it("closes the picker when the caret is deliberately moved to the start", () => {
    type("hi @He");
    select(6);
    select(0);
    expect(container.querySelector('[data-testid="mention-picker"]')).toBeNull();
  });

  it("clears a slash query before routing and uses the call control for an empty draft", () => {
    type("/settings");
    press("Settings");
    expect(props.onSlashAction).toHaveBeenCalledWith("chat-settings");
    expect(container.querySelector("input")!.value).toBe("");
    expect(container.querySelector('[data-testid="slash-picker"]')).toBeNull();
    press("Call Elio");
    expect(props.startVoiceCall).toHaveBeenCalledOnce();
  });
});

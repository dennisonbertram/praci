// @vitest-environment jsdom

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
    }: {
      value: string;
      onChangeText: typeof input.change;
      onKeyPress: typeof input.key;
    }) => {
      input.change = onChangeText;
      input.key = onKeyPress;
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
  function press(label: string) {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    expect(button).not.toBeNull();
    act(() => button.click());
  }
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

  it("selects mention and skill popovers and removes chips with backspace", () => {
    type("Hello @He");
    press("@{name}");
    expect(composer.current!.snapshot().mentions).toEqual([bot]);
    expect(container.querySelector("input")!.value).toBe("Hello ");
    expect(container.querySelector('[data-testid="mention-picker"]')).toBeNull();
    type("/Wri");
    press("Skill {name}");
    expect(composer.current!.snapshot().skill).toEqual(skill);
    expect(container.querySelector("input")!.value).toBe("");
    expect(container.querySelector('[data-testid="slash-picker"]')).toBeNull();
    act(() => input.key({ nativeEvent: { key: "Backspace" } }));
    expect(composer.current!.snapshot().mentions).toEqual([]);
    expect(composer.current!.snapshot().skill).toEqual(skill);
    act(() => input.key({ nativeEvent: { key: "Backspace" } }));
    expect(composer.current!.snapshot().skill).toBeNull();
  });

  it("clears a slash query before routing and uses the call control for an empty draft", () => {
    type("/settings");
    press("Chat Settings");
    expect(props.onSlashAction).toHaveBeenCalledWith("chat-settings");
    expect(container.querySelector("input")!.value).toBe("");
    expect(container.querySelector('[data-testid="slash-picker"]')).toBeNull();
    press("Call");
    expect(props.startVoiceCall).toHaveBeenCalledOnce();
  });
});

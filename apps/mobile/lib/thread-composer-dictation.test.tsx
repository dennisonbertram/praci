// @vitest-environment jsdom
// Wispr Flow (and iOS/Android dictation) types into the message field like a keyboard, so the
// field must not override the keyboard and must treat inserted text exactly like typed text.
import type { ReactNode } from "react";
import { act, createRef } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThreadComposerHandle } from "../components/thread-composer";
import { ThreadComposer } from "../components/thread-composer";

const state = vi.hoisted(() => ({ inputProps: {} as Record<string, unknown> }));

vi.mock("react-native", () => {
  const box = ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  );
  return {
    View: box,
    ScrollView: box,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Pressable: ({ children }: { children?: ReactNode }) => (
      <button type="button">{children}</button>
    ),
    TextInput: (props: Record<string, unknown>) => {
      state.inputProps = props;
      return null;
    },
  };
});
vi.mock("@expo/ui/community/menu", () => ({ MenuView: box }));
function box({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
vi.mock("../lib/bot-accent", () => ({
  useAccentedTokens: () => new Proxy({}, { get: () => "#000" }),
}));
vi.mock("../lib/native", () => ({
  useMobileTokens: () => new Proxy({}, { get: () => "#000" }),
  useResolvedAppearance: () => "light",
}));
vi.mock("../lib/i18n", () => ({
  useI18n: () => ({
    t: (text: string, values?: Record<string, string>) =>
      text.replace(/\{(\w+)\}/g, (_, key: string) => values?.[key] ?? ""),
  }),
}));
vi.mock("../components/glass-surface", () => ({ GlassSurface: box }));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderComposer() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const ref = createRef<ThreadComposerHandle>();
  act(() =>
    root?.render(
      <ThreadComposer
        ref={ref}
        agentSkills={[
          {
            id: "s1",
            name: "summarize",
            description: "Summarize",
            source: "user",
            readOnly: false,
          },
        ]}
        composerMentionTargets={[{ kind: "bot", id: "b2", name: "Bob" }] as never}
        composerPrompt="Message"
        replyQuote={null}
        attachmentIds={[]}
        onCall={false}
        working={false}
        sending={false}
        styles={{ circleButton: {}, composerFill: {} }}
        attachActions={[]}
        attachFrom={() => {}}
        send={async () => {}}
        stop={async () => {}}
        startVoiceCall={async () => {}}
        onSlashAction={() => {}}
      />,
    ),
  );
}

function dictate(text: string) {
  act(() => (state.inputProps.onChangeText as (value: string) => void)(text));
}

const testId = (id: string) => container?.querySelector(`[data-testid="${id}"]`) ?? null;

describe("thread message field and dictation", () => {
  it("keeps the platform keyboard defaults", () => {
    renderComposer();
    const props = state.inputProps;
    expect(props.multiline).toBe(true);
    for (const key of [
      "keyboardType",
      "autoCorrect",
      "autoCapitalize",
      "textContentType",
      "autoComplete",
      "inputMode",
    ]) {
      expect(props, key).not.toHaveProperty(key);
    }
    expect(props.secureTextEntry).toBeFalsy();
    expect(props.editable).not.toBe(false);
  });

  it("opens the skill picker when dictated text starts with a slash, as typing does", () => {
    renderComposer();
    dictate("/sum");
    expect(testId("slash-picker")).not.toBeNull();
    expect(testId("mention-picker")).toBeNull();
  });

  it("opens the mention picker when dictated text ends with an at-mention, as typing does", () => {
    renderComposer();
    dictate("Ask @Bo");
    expect(testId("mention-picker")).not.toBeNull();
  });

  it("keeps a dictated multi-paragraph message as the draft without opening a picker", () => {
    renderComposer();
    dictate("First paragraph.\n\nSecond paragraph with a / slash.");
    expect(state.inputProps.value).toBe("First paragraph.\n\nSecond paragraph with a / slash.");
    expect(testId("slash-picker")).toBeNull();
    expect(testId("mention-picker")).toBeNull();
  });
});

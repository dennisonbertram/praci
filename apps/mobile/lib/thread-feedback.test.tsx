// @vitest-environment jsdom

import { AiConsentBlocked, resolveComposerSendPlan } from "@rakazo/core";
import type { ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { ActionSheetIOS } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FailedSendBubble } from "../components/failed-send-bubble";
import type { ComposerSnapshot, SendAttempt, SendPayload } from "./thread-feedback";
import {
  clearFailedSends,
  configureUnsentSends,
  confirmEchoes,
  restoreUnsentSends,
  sendWaitingMessages,
  setThreadBubblesVisible,
  settleComposer,
  subscribeGoalReply,
  useThreadFeedback,
} from "./thread-feedback";

vi.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: vi.fn() },
  View: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
  Image: () => null,
  Pressable: ({
    children,
    onPress,
    disabled,
    accessibilityLabel,
    accessibilityHint,
    onLongPress,
    accessibilityRole,
    accessibilityActions,
    onAccessibilityAction,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    disabled: boolean;
    accessibilityLabel: string;
    accessibilityHint?: string;
    onLongPress: () => void;
    accessibilityRole?: string;
    accessibilityActions?: { name: string; label: string }[];
    onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void;
  }) =>
    createElement(
      "button",
      {
        ref: (node: HTMLButtonElement | null) => {
          if (node) {
            (
              node as HTMLButtonElement & { onAccessibilityAction?: typeof onAccessibilityAction }
            ).onAccessibilityAction = onAccessibilityAction;
          }
        },
        type: "button",
        onClick: onPress,
        onContextMenu: onLongPress,
        disabled,
        role: accessibilityRole,
        "aria-label": accessibilityLabel,
        "aria-description": accessibilityHint,
        "data-actions": JSON.stringify(accessibilityActions ?? []),
      },
      children,
    ),
  Platform: { OS: "ios" },
  ActionSheetIOS: { showActionSheetWithOptions: vi.fn() },
  Alert: { alert: vi.fn() },
}));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("./native", () => ({ useMobileTokens: () => ({}) }));
vi.mock("./i18n", () => ({
  t: (text: string) => text,
  useI18n: () => ({ t: (text: string) => text }),
}));

let feedback: ReturnType<typeof useThreadFeedback>;
let nonces = 0;
const retry = vi.fn();
function Probe({ threadKey }: { threadKey: string }) {
  feedback = useThreadFeedback(threadKey, () => `nonce-${++nonces}`);
  return feedback.unsentSends.map((attempt) => (
    <FailedSendBubble
      key={attempt.clientNonce}
      attempt={attempt}
      onRetry={retry}
      onCopy={vi.fn()}
      onDelete={() => feedback.discard(attempt)}
    />
  ));
}

function payload(text = "Hello"): SendPayload {
  return {
    originThreadKey: "bot-1",
    displayText: text,
    replyPreview: "Quoted message",
    initialBotTarget: "bot-1",
    botTarget: "bot-1",
    reroutedToGroup: false,
    plan: resolveComposerSendPlan({ text, mentions: [], hasAttachments: true }),
    attachments: [
      { id: "attachment-1", name: "photo.png", mimeType: "image/png", contentBase64: "fake" },
    ],
    replyTargetId: "reply-1",
    replyQuote: "Quoted message",
  };
}

describe("composer settlement", () => {
  const submitted: ComposerSnapshot = {
    promptText: "Hello",
    mentions: [{ kind: "bot", id: "bot-1", name: "Bot" }],
    skill: null,
    replyTargetId: "reply-1",
    replyQuote: "Quoted message",
    attachmentIds: ["attachment-1"],
  };
  it("clears an unchanged composition", () => {
    expect(settleComposer(submitted, structuredClone(submitted))).toEqual({ clearComposer: true });
  });

  it.each<Partial<ComposerSnapshot>>([
    { promptText: "Edited" },
    { mentions: [{ kind: "bot", id: "bot-2", name: "Bot" }] },
    { skill: { id: "skill-1", name: "Skill", description: "", source: "user", readOnly: false } },
    { replyTargetId: "reply-2" },
    { replyQuote: "Edited quote" },
    { attachmentIds: ["attachment-1", "attachment-2"] },
    { attachmentIds: [] },
  ])("keeps an edited composition: %j", (edit) => {
    const current = { ...submitted, ...edit };
    const before = structuredClone(current);
    expect(settleComposer(submitted, current)).toEqual({ clearComposer: false });
    expect(current).toEqual(before);
  });
});

describe("scoped mobile outbox", () => {
  let root: Root;
  let container: HTMLDivElement;
  let reachable = true;
  const scope = {
    apiBase: "https://api.example.test",
    userId: "user-a",
    cacheSession: "ns-a",
    spaceId: "space-a",
  };
  const request = vi.fn();
  const disk = {
    admit: vi.fn(() => true),
    hydrate: vi.fn(async () => undefined),
    markDiscarded: vi.fn(() => true),
    forget: vi.fn(),
    load: vi.fn(() => []),
    save: vi.fn(),
    clear: vi.fn(),
  };
  const notDelivered = vi.fn();
  const announceFailure = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    clearFailedSends();
    setThreadBubblesVisible("bot-1", false);
    vi.clearAllMocks();
    reachable = true;
    scope.spaceId = "space-a";
    request.mockImplementation(async (proc) =>
      proc === "artifacts/create" ? { id: "artifact-a" } : { seq: 42 },
    );
    configureUnsentSends({
      request,
      scope: () => scope,
      serverReachable: () => reachable,
      disk,
      errorText: String,
      notDelivered,
      announceFailure,
    });
    restoreUnsentSends();
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(<Probe threadKey="bot-1" />));
  });
  afterEach(() => {
    act(() => root.unmount());
    setThreadBubblesVisible("bot-1", false);
    clearFailedSends();
    vi.unstubAllGlobals();
  });
  it("shows the optimistic payload before confirmation, then replaces it with the echo", async () => {
    let finish!: (value: { seq: number }) => void;
    request.mockImplementation(async (proc) =>
      proc === "artifacts/create"
        ? { id: "artifact-a" }
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const attempt = feedback.sendAttempt(payload());
    let sending!: Promise<boolean>;
    act(() => {
      sending = feedback.send(attempt);
    });
    expect(container.textContent).toContain("Hello");
    expect(container.textContent).toContain("Sending…");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    const writes = disk.save.mock.calls.length;
    act(() => confirmEchoes("bot-1", []));
    expect(disk.save).toHaveBeenCalledTimes(writes);
    await act(async () => {
      finish({ seq: 42 });
      await sending;
    });
    act(() => confirmEchoes("bot-1", [42]));
    expect(container.textContent).toBe("");
  });
  it("keeps sends ordered, persisted and scoped while offline, and retries on reconnect", async () => {
    reachable = false;
    const first = feedback.sendAttempt(payload("First"));
    const second = feedback.sendAttempt(payload("Second"));
    await act(async () => {
      await feedback.send(first);
      await feedback.send(second);
    });
    expect(request).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Not sent · Tap to retry");
    expect(disk.save).toHaveBeenLastCalledWith([first, second]);
    reachable = true;
    await act(async () => {
      await sendWaitingMessages();
    });
    expect(
      request.mock.calls.filter(([proc]) => proc === "threads/send").map(([, body]) => body.text),
    ).toEqual(["First", "Second"]);
  });
  it("records discard intent before removing an offline send", async () => {
    reachable = false;
    const attempt = feedback.sendAttempt(payload());
    await act(async () => {
      await feedback.send(attempt);
    });
    disk.markDiscarded.mockReturnValueOnce(true);

    act(() => feedback.discard(attempt));

    expect(disk.markDiscarded).toHaveBeenCalledWith(attempt);
    expect(disk.forget).toHaveBeenCalledWith(attempt);
    expect(disk.markDiscarded.mock.invocationCallOrder[0]).toBeLessThan(
      disk.forget.mock.invocationCallOrder[0]!,
    );
    expect(disk.save).toHaveBeenLastCalledWith([]);
    expect(container.textContent).toBe("");
  });
  it("keeps a message visible when discard intent cannot be persisted", async () => {
    reachable = false;
    const attempt = feedback.sendAttempt(payload());
    await act(async () => {
      await feedback.send(attempt);
    });
    disk.markDiscarded.mockReturnValueOnce(false);

    act(() => feedback.discard(attempt));

    expect(disk.forget).not.toHaveBeenCalled();
    expect(disk.save).toHaveBeenLastCalledWith([attempt]);
    expect(container.textContent).toContain("Hello");
  });
  it("drops late failures and further uploads after a session wipe", async () => {
    let finish!: (value: { id: string }) => void;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const attempt = feedback.sendAttempt(payload());
    let sending!: Promise<boolean>;
    act(() => {
      sending = feedback.send(attempt);
    });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    act(() => clearFailedSends());
    await act(async () => {
      finish({ id: "artifact-a" });
      await sending;
    });
    expect(request).toHaveBeenCalledOnce();
    expect(notDelivered).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
    expect(disk.clear).toHaveBeenCalled();
  });
  it("alerts for a mounted but unfocused origin chat", async () => {
    const attempt = feedback.sendAttempt(payload());
    request.mockRejectedValueOnce(new Error("Quota exceeded"));
    await act(async () => {
      await feedback.send(attempt);
    });
    expect(notDelivered).toHaveBeenCalledWith(attempt);
    expect(announceFailure).not.toHaveBeenCalled();
  });
  it("alerts when a focused chat has an older page pinned", async () => {
    setThreadBubblesVisible("bot-1", false);
    const attempt = feedback.sendAttempt(payload());
    request.mockRejectedValueOnce(new Error("Quota exceeded"));
    await act(async () => {
      await feedback.send(attempt);
    });
    expect(notDelivered).toHaveBeenCalledWith(attempt);
    expect(announceFailure).not.toHaveBeenCalled();
  });
  it("announces a failure in a focused unpinned chat", async () => {
    setThreadBubblesVisible("bot-1", true);
    const attempt = feedback.sendAttempt(payload());
    request.mockRejectedValueOnce(new Error("Quota exceeded"));
    await act(async () => {
      await feedback.send(attempt);
    });
    expect(notDelivered).not.toHaveBeenCalled();
    expect(announceFailure).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Not sent · Tap to retry");
  });
  it("announces a refused 4xx failure in a visible chat", async () => {
    setThreadBubblesVisible("bot-1", true);
    const attempt = feedback.sendAttempt(payload());
    request.mockRejectedValueOnce(Object.assign(new Error("Refused"), { status: 400 }));
    await act(async () => {
      await feedback.send(attempt);
    });
    expect(attempt.state).toBe("refused");
    expect(notDelivered).not.toHaveBeenCalled();
    expect(announceFailure).toHaveBeenCalledOnce();
  });
  it("reuses uploaded artifacts on manual retry", async () => {
    setThreadBubblesVisible("bot-1", true);
    const attempt = feedback.sendAttempt(payload());
    request
      .mockResolvedValueOnce({ id: "artifact-a" })
      .mockRejectedValueOnce(new Error("Quota exceeded"));
    await act(async () => {
      await feedback.send(attempt);
    });
    await act(async () => {
      await feedback.send(attempt);
    });
    expect(request.mock.calls.filter(([proc]) => proc === "artifacts/create")).toHaveLength(1);
    const sends = request.mock.calls.filter(([proc]) => proc === "threads/send");
    expect(sends[0]).toEqual(sends[1]);
  });
  it("reports a failure when the origin chat is unmounted", async () => {
    const attempt = feedback.sendAttempt(payload());
    act(() => root.unmount());
    request.mockRejectedValueOnce(new Error("Quota exceeded"));
    await act(async () => {
      await feedback.send(attempt);
    });
    expect(notDelivered).toHaveBeenCalledWith(attempt);
  });
  it.each([false, true])("pauses the ordered queue on HTTP 429 (wrapped: %s)", async (wrapped) => {
    reachable = false;
    const first = feedback.sendAttempt(payload("First"));
    const second = feedback.sendAttempt(payload("Second"));
    await act(async () => {
      await feedback.send(first);
      await feedback.send(second);
    });
    reachable = true;
    const error = Object.assign(new Error("Slow down"), { status: 429 });
    request.mockRejectedValueOnce(wrapped ? new AiConsentBlocked("Consent check", error) : error);
    await act(async () => {
      await sendWaitingMessages();
    });
    expect(first.state).toBe("queued");
    expect(second.state).toBe("queued");
    expect(request).toHaveBeenCalledOnce();
    expect(notDelivered).not.toHaveBeenCalled();
  });
  it.each([408, 425])("pauses the ordered queue on a transient HTTP %i", async (status) => {
    reachable = false;
    const first = feedback.sendAttempt(payload("First"));
    const second = feedback.sendAttempt(payload("Second"));
    await act(async () => {
      await feedback.send(first);
      await feedback.send(second);
    });
    reachable = true;
    request.mockRejectedValueOnce(Object.assign(new Error("Try later"), { status }));
    await act(async () => {
      await sendWaitingMessages();
    });
    expect(first.state).toBe("queued");
    expect(second.state).toBe("queued");
    expect(request).toHaveBeenCalledOnce();
    expect(notDelivered).not.toHaveBeenCalled();
    // The retry replays the same nonces, so a dispatch that reached the server cannot repeat.
    await act(async () => {
      await sendWaitingMessages();
    });
    const creates = request.mock.calls.filter(([proc]) => proc === "artifacts/create");
    expect(creates.map(([, body]) => body.clientNonce)).toEqual([
      `${first.clientNonce}:0`,
      `${first.clientNonce}:0`,
      `${second.clientNonce}:0`,
    ]);
    const sends = request.mock.calls.filter(([proc]) => proc === "threads/send");
    expect(sends.map(([, body]) => body.clientNonce)).toEqual([
      first.clientNonce,
      second.clientNonce,
    ]);
    expect(first.acceptedSeq).toBe(42);
    expect(second.acceptedSeq).toBe(42);
  });
  it("retries after a reconnect that arrived during an in-flight send", async () => {
    let rejectUpload!: (error: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpload = reject;
        }),
    );
    const attempt = feedback.sendAttempt(payload("Held"));
    let sending!: Promise<boolean>;
    act(() => {
      sending = feedback.send(attempt);
    });
    await vi.waitFor(() => expect(rejectUpload).toBeTypeOf("function"));
    const replay = sendWaitingMessages();
    await act(async () => {
      rejectUpload(Object.assign(new Error("unavailable"), { status: 503 }));
      await sending;
      await replay;
    });
    expect(attempt.acceptedSeq).toBe(42);
    expect(request.mock.calls.filter(([proc]) => proc === "threads/send")).toHaveLength(1);
    expect(notDelivered).not.toHaveBeenCalled();
  });
  it("allows Retry after a consent conflict before dispatch", async () => {
    const attempt = feedback.sendAttempt(payload());
    request.mockRejectedValueOnce(
      new AiConsentBlocked(
        "Review consent again",
        Object.assign(new Error("Changed"), { status: 409 }),
      ),
    );
    await act(async () => {
      await feedback.send(attempt);
    });
    expect(attempt.state).toBe("failed");
    await act(async () => {
      await feedback.send(attempt, true);
    });
    expect(attempt.acceptedSeq).toBe(42);
  });
  it("keeps the original Space while selection changes during an upload", async () => {
    let finish!: (value: { id: string }) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const attempt = feedback.sendAttempt(payload());
    let sending!: Promise<boolean>;
    act(() => {
      sending = feedback.send(attempt);
    });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    scope.spaceId = "space-b";
    await act(async () => {
      finish({ id: "artifact-a" });
      await sending;
    });
    const [send] = request.mock.calls.filter(([proc]) => proc === "threads/send");
    expect(send?.[3]).toBe("space-a");
    expect(attempt.acceptedSeq).toBe(42);
  });
  it("shows the server's answer to /goal as a notice, not a failed send", async () => {
    const replies: Array<[string, string]> = [];
    const stop = subscribeGoalReply((threadKey, text) => replies.push([threadKey, text]));
    const attempt = feedback.sendAttempt(payload("/goal"));
    request
      .mockResolvedValueOnce({ id: "artifact-a" })
      .mockRejectedValueOnce(
        Object.assign(new Error("No goal set."), { status: 400, data: { goalReply: true } }),
      );
    await act(async () => {
      await feedback.send(attempt);
    });
    stop();
    expect(replies).toEqual([["bot-1", "No goal set."]]);
    expect(notDelivered).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
  });
});

describe("failed-send bubble accessibility", () => {
  function attempt(state: SendAttempt["state"]): SendAttempt {
    return {
      payload: {
        originThreadKey: "bot-1",
        displayText: "Hello",
        replyPreview: null,
        reroutedToGroup: false,
        plan: resolveComposerSendPlan({ text: "Hello", mentions: [], hasAttachments: false }),
        attachments: [],
        replyQuote: null,
      },
      clientNonce: "nonce-1",
      artifactIds: new Map(),
      state,
      apiBase: "https://api.example.test",
      spaceId: null,
      userId: "user-1",
      cacheSession: "cache-1",
      session: 0,
    };
  }

  it("exposes Delete for refused messages without presenting them as buttons", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const onDelete = vi.fn();
    act(() =>
      root.render(
        <FailedSendBubble
          attempt={attempt("refused")}
          onRetry={vi.fn()}
          onCopy={vi.fn()}
          onDelete={onDelete}
        />,
      ),
    );
    const bubble = container.querySelector("button");
    expect(bubble?.getAttribute("role")).not.toBe("button");
    expect(JSON.parse(bubble?.getAttribute("data-actions") ?? "[]")).toEqual([
      { name: "delete", label: "Delete" },
    ]);
    const action = (
      bubble as
        | (HTMLButtonElement & {
            onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void;
          })
        | null
    )?.onAccessibilityAction;
    act(() => action?.({ nativeEvent: { actionName: "delete" } }));
    expect(ActionSheetIOS.showActionSheetWithOptions).toHaveBeenCalledOnce();
    act(() => vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0]?.[1]?.(1));
    expect(onDelete).toHaveBeenCalledOnce();
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("offers Copy before Delete for refused messages", () => {
    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mockClear();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const onCopy = vi.fn();
    const onDelete = vi.fn();
    act(() =>
      root.render(
        <FailedSendBubble
          attempt={attempt("refused")}
          onRetry={vi.fn()}
          onCopy={onCopy}
          onDelete={onDelete}
        />,
      ),
    );
    const bubble = container.querySelector("button") as HTMLButtonElement & {
      onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void;
    };
    act(() => bubble.onAccessibilityAction?.({ nativeEvent: { actionName: "delete" } }));
    const [options, onSelect] =
      vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls.at(-1) ?? [];
    expect(options?.options).toEqual(["Copy", "Delete", "Cancel"]);
    expect(options?.destructiveButtonIndex).toBe(1);
    act(() => onSelect?.(0));
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("keeps Try Again first and Delete destructive for retryable messages", () => {
    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mockClear();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <FailedSendBubble
          attempt={attempt("failed")}
          onRetry={vi.fn()}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
        />,
      ),
    );
    const bubble = container.querySelector("button") as HTMLButtonElement & {
      onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void;
    };
    act(() => bubble.onAccessibilityAction?.({ nativeEvent: { actionName: "delete" } }));
    const [options] = vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls.at(-1) ?? [];
    expect(options?.options?.[0]).toBe("Try Again");
    expect(options?.destructiveButtonIndex).toBe(options?.options?.indexOf("Delete"));
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("keeps failed messages as retry buttons", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const onRetry = vi.fn();
    act(() =>
      root.render(
        <FailedSendBubble
          attempt={attempt("failed")}
          onRetry={onRetry}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
        />,
      ),
    );
    const bubble = container.querySelector("button");
    expect(bubble?.getAttribute("role")).toBe("button");
    act(() => bubble?.click());
    expect(onRetry).toHaveBeenCalledOnce();
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("exposes no accessibility actions while sending", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <FailedSendBubble
          attempt={attempt("pending")}
          onRetry={vi.fn()}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
        />,
      ),
    );
    const bubble = container.querySelector("button");
    expect(JSON.parse(bubble?.getAttribute("data-actions") ?? "[]")).toEqual([]);
    expect(
      (bubble as (HTMLButtonElement & { onAccessibilityAction?: unknown }) | null)
        ?.onAccessibilityAction,
    ).toBeUndefined();
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
});

// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ComponentProps, ReactNode } from "react";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), ""),
}));

import {
  readChatDraft,
  readChatDraftMentions,
  readChatDraftSkill,
  writeChatDraft,
  writeChatDraftMentions,
  writeChatDraftSkill,
} from "../../lib/chat-draft";
import { Composer } from "./composer";

i18n.loadAndActivate({ locale: "en", messages: {} });

let root: ReturnType<typeof createRoot>;
function createTestRoot() {
  root = createRoot(document.body.appendChild(document.createElement("div")));
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
  createTestRoot();
});
afterEach(() => {
  act(() => root.unmount());
  window.sessionStorage.clear();
  document.body.innerHTML = "";
});

function render(node: ReactNode) {
  root.render(<I18nProvider i18n={i18n}>{node}</I18nProvider>);
}

it("restores a failed send to chat storage after the composer unmounts", async () => {
  let resolveSend!: (result: boolean) => void;
  const onSend = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        resolveSend = resolve;
      }),
  );
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        draftKey="bot:a"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        onRetrySend={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={onSend}
        onStop={async () => {}}
        artifactTarget={{ botId: "a" }}
      />,
    ),
  );
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      box,
      "hello",
    );
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    (document.querySelector('[aria-label="Send"]') as HTMLButtonElement).click();
  });
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(readChatDraft("bot:a")).toBe("");
  act(() => root.unmount());
  await act(async () => resolveSend(false));
  expect(readChatDraft("bot:a")).toBe("hello");
});

it("restores mentions and skill with a failed draft after unmount", async () => {
  const mention = { kind: "bot" as const, id: "b", name: "Agent" };
  const skill = { name: "Summarize", source: "bot" };
  writeChatDraft("bot:restore-parts", "hello @Agent");
  writeChatDraftMentions("bot:restore-parts", [mention]);
  writeChatDraftSkill("bot:restore-parts", skill);
  let resolveSend!: (result: boolean) => void;
  const onSend = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        resolveSend = resolve;
      }),
  );
  const ui = (
    <Composer
      activeName="Agent"
      draftKey="bot:restore-parts"
      running={false}
      pendingAttachments={[]}
      attachmentNotice={null}
      sendError={null}
      runError={null}
      runErrorId={null}
      onRunErrorPresented={() => {}}
      onDismissError={() => {}}
      sending={false}
      fileInputRef={createRef()}
      onAttachmentPick={() => false}
      onRemoveAttachment={() => {}}
      onSend={onSend}
      onStop={async () => {}}
      artifactTarget={{ botId: "restore-parts" }}
    />
  );
  await act(async () => render(ui));
  await act(async () => sendButton().click());
  act(() => root.unmount());
  await act(async () => resolveSend(false));
  expect(readChatDraft("bot:restore-parts")).toBe("hello @Agent");
  expect(readChatDraftMentions("bot:restore-parts")).toEqual([{ start: 6, end: 12, mention }]);
  expect(readChatDraftSkill("bot:restore-parts")).toEqual(skill);
});

it("does not restore storage while a composer for the draft key is mounted", async () => {
  let resolveSend!: (result: boolean) => void;
  const onSend = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        resolveSend = resolve;
      }),
  );
  const ui = (
    <Composer
      activeName="Agent"
      draftKey="bot:reopened"
      running={false}
      pendingAttachments={[]}
      attachmentNotice={null}
      sendError={null}
      runError={null}
      runErrorId={null}
      onRunErrorPresented={() => {}}
      onDismissError={() => {}}
      sending={false}
      fileInputRef={createRef()}
      onAttachmentPick={() => false}
      onRemoveAttachment={() => {}}
      onSend={onSend}
      onStop={async () => {}}
      artifactTarget={{ botId: "reopened" }}
    />
  );
  await act(async () => render(ui));
  await typeIn(document.querySelector("textarea") as HTMLTextAreaElement, "hello");
  await act(async () => sendButton().click());
  act(() => root.unmount());
  createTestRoot();
  await act(async () => render(ui));
  await act(async () => resolveSend(false));
  expect(readChatDraft("bot:reopened")).toBe("");
});

it("does not restore a send that throws after unmount", async () => {
  const error = new Error("uncertain acceptance");
  let rejectSend!: (error: Error) => void;
  const onSend = vi.fn(
    () =>
      new Promise<boolean>((_resolve, reject) => {
        rejectSend = reject;
      }),
  );
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        draftKey="bot:throws"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={onSend}
        onStop={async () => {}}
        artifactTarget={{ botId: "throws" }}
      />,
    ),
  );
  await typeIn(document.querySelector("textarea") as HTMLTextAreaElement, "hello");
  await act(async () => sendButton().click());
  act(() => root.unmount());
  await act(async () => rejectSend(error));
  expect(readChatDraft("bot:throws")).toBe("");
});

it("does not overwrite a stored skill-only draft after an unmounted failure", async () => {
  const skill = { name: "Summarize", source: "bot" };
  writeChatDraftSkill("bot:skill-only", skill);
  let resolveSend!: (result: boolean) => void;
  const onSend = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        resolveSend = resolve;
      }),
  );
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        draftKey="bot:skill-only"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={onSend}
        onStop={async () => {}}
        artifactTarget={{ botId: "skill-only" }}
      />,
    ),
  );
  await typeIn(document.querySelector("textarea") as HTMLTextAreaElement, "hello");
  await act(async () => sendButton().click());
  act(() => root.unmount());
  writeChatDraftSkill("bot:skill-only", { name: "Keep" });
  await act(async () => resolveSend(false));
  expect(readChatDraft("bot:skill-only")).toBe("");
  expect(readChatDraftSkill("bot:skill-only")).toEqual({ name: "Keep" });
});

it("keeps the stored draft empty after an unmounted send succeeds", async () => {
  let resolveSend!: (result: boolean) => void;
  const onSend = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        resolveSend = resolve;
      }),
  );
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        draftKey="bot:a"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        onRetrySend={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={onSend}
        onStop={async () => {}}
        artifactTarget={{ botId: "a" }}
      />,
    ),
  );
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      box,
      "hello",
    );
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    (document.querySelector('[aria-label="Send"]') as HTMLButtonElement).click();
  });
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(readChatDraft("bot:a")).toBe("");
  act(() => root.unmount());
  await act(async () => resolveSend(true));
  expect(readChatDraft("bot:a")).toBe("");
});

it("Retry resends the restored draft with its nonce and clears it once the send succeeds", async () => {
  const onSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const onRetrySend = vi.fn();
  const ui = (sendError: string | null) => (
    <Composer
      activeName="Agent"
      running={false}
      pendingAttachments={[]}
      attachmentNotice={null}
      sendError={sendError}
      runError={null}
      runErrorId={null}
      onRunErrorPresented={() => {}}
      onDismissError={() => {}}
      onRetrySend={onRetrySend}
      sending={false}
      fileInputRef={createRef()}
      onAttachmentPick={() => false}
      onRemoveAttachment={() => {}}
      onSend={onSend}
      onStop={async () => {}}
      artifactTarget={{ botId: "b" }}
    />
  );
  await act(async () => render(ui(null)));
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      box,
      "hello",
    );
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onSend).toHaveBeenCalledTimes(1);
  await act(async () => render(ui("Could not reach")));
  expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("hello");
  const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "Retry");
  await act(async () => retry?.click());
  expect(onRetrySend).not.toHaveBeenCalled();
  expect(onSend).toHaveBeenCalledTimes(2);
  expect(onSend.mock.calls[1]?.[0]).toBe("hello");
  expect(onSend.mock.calls[1]?.[2]).toBe(onSend.mock.calls[0]?.[2]);
  expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
});

it("Retry sends the edited text when the restored draft was changed", async () => {
  const onSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const ui = (sendError: string | null) => (
    <Composer
      activeName="Agent"
      running={false}
      pendingAttachments={[]}
      attachmentNotice={null}
      sendError={sendError}
      runError={null}
      runErrorId={null}
      onRunErrorPresented={() => {}}
      onDismissError={() => {}}
      onRetrySend={() => {}}
      sending={false}
      fileInputRef={createRef()}
      onAttachmentPick={() => false}
      onRemoveAttachment={() => {}}
      onSend={onSend}
      onStop={async () => {}}
      artifactTarget={{ botId: "b2" }}
    />
  );
  const type = async (text: string) => {
    const box = document.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, text);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await act(async () => render(ui(null)));
  await type("hello");
  await act(async () => {
    document
      .querySelector("textarea")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await act(async () => render(ui("Could not reach")));
  await type("hello world");
  const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "Retry");
  await act(async () => retry?.click());
  expect(onSend.mock.calls[1]?.[0]).toBe("hello world");
});

it("ends a long agent name in the placeholder with an ellipsis", async () => {
  await act(async () =>
    render(
      <Composer
        activeName={"Quarterly investor relations planning assistant ".repeat(3)}
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={vi.fn()}
        onStop={async () => {}}
        artifactTarget={{ botId: "b3" }}
      />,
    ),
  );
  const placeholder = (document.querySelector("textarea") as HTMLTextAreaElement).placeholder;
  expect(placeholder.endsWith("…")).toBe(true);
  expect(placeholder.length).toBeLessThan(45);
});

it("on a touch screen Return adds a line and only the Send button sends", async () => {
  window.matchMedia = ((q: string) => ({
    matches: q === "(pointer: coarse)",
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
  const onSend = vi.fn().mockResolvedValue(true);
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        onRetrySend={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={onSend}
        onStop={async () => {}}
        artifactTarget={{ botId: "b3" }}
      />,
    ),
  );
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, "hi");
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  await act(async () => {
    box.dispatchEvent(enter);
  });
  expect(enter.defaultPrevented).toBe(false);
  expect(onSend).not.toHaveBeenCalled();
});

async function renderTyped(running: boolean, coarse = false) {
  window.matchMedia = ((q: string) => ({
    matches: coarse && q === "(pointer: coarse)",
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        running={running}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        onRetrySend={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={vi.fn().mockResolvedValue(true)}
        onStop={async () => {}}
        artifactTarget={{ botId: "b4" }}
      />,
    ),
  );
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, "hi");
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const send = document.querySelector<HTMLButtonElement>('button[aria-label="Send"]');
  send?.focus();
  await act(async () => send?.click());
  return box;
}

it("keeps focus in the message box after Send is clicked", async () => {
  const box = await renderTyped(false);
  expect(document.activeElement).toBe(box);
});

it("keeps focus in the message box after Send is clicked during a run", async () => {
  const box = await renderTyped(true);
  expect(document.activeElement).toBe(box);
});

it("does not focus the message box after Send on a touch screen", async () => {
  const box = await renderTyped(false, true);
  expect(document.activeElement).not.toBe(box);
});

async function renderWithMentions(targets: Array<{ kind: "bot"; id: string; name: string }>) {
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        onRetrySend={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={vi.fn().mockResolvedValue(true)}
        onStop={async () => {}}
        artifactTarget={{ botId: "b5" }}
        mentionTargets={targets}
      />,
    ),
  );
  return document.querySelector("textarea") as HTMLTextAreaElement;
}

async function typeIn(box: HTMLTextAreaElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const sendButton = () =>
  document.querySelector<HTMLButtonElement>('button[aria-label="Send"]') as HTMLButtonElement;

it("disables pending chip removal while sending and enables it again afterward", async () => {
  const attachment = {
    id: "attachment-1",
    threadKey: "bot:chips",
    file: new File(["content"], "notes.txt", { type: "text/plain" }),
  };
  const dataRoomItem = {
    id: "data-room-1",
    name: "brief.pdf",
    mimeType: "application/pdf",
    threadKey: "bot:chips",
  };
  const props: ComponentProps<typeof Composer> = {
    activeName: "Agent",
    draftKey: "bot:chips",
    running: false,
    pendingAttachments: [attachment],
    dataRoomItems: [dataRoomItem],
    attachmentNotice: null,
    sendError: null,
    runError: null,
    runErrorId: null,
    onRunErrorPresented: () => {},
    onDismissError: () => {},
    sending: true,
    fileInputRef: createRef(),
    onAttachmentPick: () => false,
    onRemoveAttachment: () => {},
    onRemoveDataRoomItem: () => {},
    onSend: async () => true,
    onStop: async () => {},
    artifactTarget: { botId: "chips" },
  };

  await act(async () => render(<Composer {...props} />));
  const attachmentRemove = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove notes.txt"]',
  )!;
  const dataRoomRemove = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove brief.pdf"]',
  )!;
  expect(attachmentRemove.disabled).toBe(true);
  expect(dataRoomRemove.disabled).toBe(true);

  await act(async () => render(<Composer {...props} sending={false} />));
  expect(attachmentRemove.disabled).toBe(false);
  expect(dataRoomRemove.disabled).toBe(false);
});

function draftComposer(draftKey: string, onSend: ComponentProps<typeof Composer>["onSend"]) {
  return (
    <Composer
      activeName="Agent"
      draftKey={draftKey}
      running={false}
      pendingAttachments={[]}
      attachmentNotice={null}
      sendError={null}
      runError={null}
      runErrorId={null}
      onRunErrorPresented={() => {}}
      onDismissError={() => {}}
      sending={false}
      fileInputRef={createRef()}
      onAttachmentPick={() => false}
      onRemoveAttachment={() => {}}
      onSend={onSend}
      onStop={async () => {}}
      artifactTarget={{ botId: draftKey }}
    />
  );
}

async function restoreAfterUnmount(
  draftKey: string,
  onSend: ComponentProps<typeof Composer>["onSend"],
) {
  await act(async () => render(draftComposer(draftKey, onSend)));
  await typeIn(document.querySelector("textarea") as HTMLTextAreaElement, "retry this");
  await act(async () => sendButton().click());
  act(() => root.unmount());
  createTestRoot();
}

it("reuses the failed nonce after remounting an unchanged restored draft", async () => {
  let resolveSend!: (result: boolean) => void;
  const onSend = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSend = resolve;
        }),
    )
    .mockResolvedValue(true);
  await restoreAfterUnmount("bot:nonce-reuse", onSend);
  const originalNonce = onSend.mock.calls[0]?.[2];
  await act(async () => resolveSend(false));
  await act(async () => render(draftComposer("bot:nonce-reuse", onSend)));
  await act(async () => sendButton().click());
  expect(onSend.mock.calls[1]?.[0]).toBe("retry this");
  expect(onSend.mock.calls[1]?.[2]).toBe(originalNonce);
});

it("uses a fresh nonce when the restored draft is edited before sending", async () => {
  let resolveSend!: (result: boolean) => void;
  const onSend = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSend = resolve;
        }),
    )
    .mockResolvedValue(true);
  await restoreAfterUnmount("bot:nonce-edit", onSend);
  const originalNonce = onSend.mock.calls[0]?.[2];
  await act(async () => resolveSend(false));
  await act(async () => render(draftComposer("bot:nonce-edit", onSend)));
  await typeIn(document.querySelector("textarea") as HTMLTextAreaElement, "changed");
  await act(async () => sendButton().click());
  expect(onSend.mock.calls[1]?.[0]).toBe("changed");
  expect(onSend.mock.calls[1]?.[2]).not.toBe(originalNonce);
});

it("disables Send while a typed mention has no match, and Escape enables it", async () => {
  const box = await renderWithMentions([{ kind: "bot", id: "inbox", name: "Inbox agent" }]);
  await typeIn(box, "@zz");
  expect(document.querySelector('[data-testid="mention-picker-empty"]')).not.toBeNull();
  expect(sendButton().disabled).toBe(true);
  await act(async () => {
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(document.querySelector('[data-testid="mention-picker-empty"]')).toBeNull();
  expect(sendButton().disabled).toBe(false);
});

it("scrolls the newly highlighted mention option into view", async () => {
  const scroll = vi.fn();
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scroll as never;
  try {
    const box = await renderWithMentions([
      { kind: "bot", id: "inbox", name: "Inbox agent" },
      { kind: "bot", id: "brex", name: "Brex agent" },
      { kind: "bot", id: "finance", name: "Finance agent" },
    ]);
    await typeIn(box, "@");
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options).toHaveLength(3);
    expect(scroll.mock.instances.at(-1)).toBe(options[0]);
    await act(async () => {
      box.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      );
    });
    expect(scroll.mock.instances.at(-1)).toBe(options[1]);
    expect(scroll.mock.calls.at(-1)?.[0]).toEqual({ block: "nearest" });
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});

it("keeps the mention and slash pickers scrollable instead of clipping them", async () => {
  const box = await renderWithMentions([{ kind: "bot", id: "inbox", name: "Inbox agent" }]);
  await typeIn(box, "@");
  expect(
    document.querySelector('[data-testid="mention-picker"]')?.classList.contains("overflow-y-auto"),
  ).toBe(true);
  await typeIn(box, "/");
  expect(
    document.querySelector('[data-testid="slash-picker"]')?.classList.contains("overflow-y-auto"),
  ).toBe(true);
});

it("says a message is too long and keeps it, instead of sending it", async () => {
  const onSend = vi.fn(async () => true);
  await act(async () =>
    render(
      <Composer
        activeName="Agent"
        draftKey="bot:long"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        onRetrySend={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={onSend}
        onStop={async () => {}}
        artifactTarget={{ botId: "a" }}
      />,
    ),
  );
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      box,
      "x".repeat(100_001),
    );
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Too long to send");
  await act(async () => {
    (document.querySelector('[aria-label="Send"]') as HTMLButtonElement).click();
  });
  expect(onSend).not.toHaveBeenCalled();
  expect(box.value).toHaveLength(100_001);
});

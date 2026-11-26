// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const messaging = vi.hoisted(() => ({
  status: vi.fn(),
  channels: vi.fn(),
  respond: vi.fn(),
  leave: vi.fn(),
  unlink: vi.fn(),
  linkStart: vi.fn(),
  updatePolicy: vi.fn(),
  connections: vi.fn(),
  connectionRespond: vi.fn(),
  revoke: vi.fn(),
  onSave: vi.fn(),
}));
const botsList = vi.hoisted(() => vi.fn());
const spacesList = vi.hoisted(() => vi.fn());

vi.mock("../lib/rpc", () => ({
  rpc: {
    messaging: {
      status: messaging.status,
      channels: { list: messaging.channels, respond: messaging.respond, leave: messaging.leave },
      identities: { unlink: messaging.unlink },
      link: { start: messaging.linkStart },
      connections: {
        list: messaging.connections,
        respond: messaging.connectionRespond,
        revoke: messaging.revoke,
      },
    },
    externalConversations: { updatePolicy: messaging.updatePolicy },
    bots: { list: botsList },
    spaces: { list: spacesList },
  },
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => <button {...props} />,
    Dialog: Container,
    DialogClose: Container,
    DialogContent: Container,
    DialogTitle: Container,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    Skeleton: ({ className }: { className?: string }) => <div className={className} />,
  };
});
vi.mock("lucide-react", () => ({ XIcon: () => null }));
vi.mock("./ExternalConversationSettings", () => ({
  ExternalConversationSettings: ({ onSave }: { onSave: (policy: unknown) => Promise<void> }) => {
    messaging.onSave(onSave);
    return (
      <button type="button" onClick={() => void onSave({})}>
        Save conversation settings
      </button>
    );
  },
}));
vi.mock("../components/ShellSkeleton", () => ({ StillLoading: () => null }));

import { MessagingSettingsOverlay } from "./MessagingSettingsOverlay";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function emptyResponses() {
  vi.clearAllMocks();
  messaging.status.mockResolvedValue({
    enabled: true,
    providers: [],
    openSignup: false,
    identities: [
      {
        id: "identity-1",
        provider: "slack",
        address: "demo",
        botId: "bot-1",
        botName: "Demo bot",
      },
    ],
  });
  messaging.channels.mockResolvedValue([]);
  messaging.connections.mockResolvedValue([]);
  botsList.mockResolvedValue([]);
  spacesList.mockResolvedValue({ current: { externalConversations: [] } });
}

it("does not show empty states while the first refresh is pending", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  emptyResponses();
  const pending = deferred<void>();
  messaging.status.mockReturnValue(pending.promise);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MessagingSettingsOverlay onClose={() => undefined} />));
    expect(container.textContent).not.toContain("No chat apps linked yet.");
    expect(container.textContent).not.toContain("No group chats yet.");
    expect(container.textContent).not.toContain("No agent connections yet.");
  } finally {
    pending.resolve(undefined);
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("offers retry after the first load fails and clears the error after recovery", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  emptyResponses();
  messaging.status.mockRejectedValueOnce(new Error("offline"));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MessagingSettingsOverlay onClose={() => undefined} />));
    expect(container.textContent).toContain("Couldn't load messaging settings");
    // A failed load shows no lists, so it never looks like nothing is connected.
    expect(container.textContent).not.toContain("Chat apps");
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).toBeTruthy();
    await act(async () => retry?.click());
    expect(container.textContent).toContain("demo → Demo bot");
    expect(container.textContent).not.toContain("Couldn't load messaging settings");
    expect(messaging.status).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("locks messaging actions while an approval is pending and unlocks after failure", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  emptyResponses();
  messaging.status.mockResolvedValue({
    enabled: true,
    providers: [],
    openSignup: false,
    identities: [
      {
        id: "identity-1",
        provider: "slack",
        address: "demo",
        botId: "bot-1",
        botName: "Demo bot",
      },
    ],
  });
  messaging.channels.mockResolvedValue([
    {
      id: "channel-1",
      identityId: "identity-1",
      name: "Demo channel",
      status: "invited",
      memberCount: 1,
    },
    {
      id: "channel-approved",
      identityId: "identity-1",
      name: "Approved channel",
      status: "approved",
      memberCount: 1,
    },
  ]);
  messaging.connections.mockResolvedValue([
    {
      id: "connection-pending",
      peerOwnerLabel: "Peer",
      peerBotName: "Pending",
      status: "pending",
      incoming: true,
    },
    {
      id: "connection-approved",
      peerOwnerLabel: "Peer",
      peerBotName: "Approved",
      status: "approved",
      incoming: true,
    },
  ]);
  botsList.mockResolvedValue([{ id: "bot-1", name: "Demo bot" }]);
  const pending = deferred<unknown>();
  messaging.respond.mockReturnValue(pending.promise);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MessagingSettingsOverlay onClose={() => undefined} />));
    const button = (label: string, index = 0) =>
      [...container.querySelectorAll("button")].filter(
        (candidate) => candidate.textContent === label,
      )[index];
    const approve = button("Approve");
    const decline = button("Decline");
    const unlink = button("Unlink");
    const leave = button("Leave");
    const revoke = button("Revoke");
    const link = button("Link a chat app");
    const botSelect = container.querySelector("select");
    expect(approve).toBeTruthy();
    expect(decline).toBeTruthy();
    expect(unlink).toBeTruthy();
    expect(leave).toBeTruthy();
    expect(revoke).toBeTruthy();
    expect(link).toBeTruthy();
    expect(botSelect).toBeTruthy();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
        botSelect,
        "bot-1",
      );
      botSelect?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      approve?.click();
      approve?.click();
    });

    expect(messaging.respond).toHaveBeenCalledTimes(1);
    expect(approve?.disabled).toBe(true);
    expect(decline?.disabled).toBe(true);
    expect(unlink?.disabled).toBe(true);
    expect(leave?.disabled).toBe(true);
    expect(revoke?.disabled).toBe(true);
    expect(button("Approve", 1)?.disabled).toBe(true);
    expect(button("Decline", 1)?.disabled).toBe(true);
    expect(link?.disabled).toBe(true);
    expect(botSelect?.disabled).toBe(true);

    await act(async () => pending.reject(new Error("already approved")));

    expect(container.textContent).toContain("Couldn't update messaging settings");
    expect(approve?.disabled).toBe(false);
    expect(decline?.disabled).toBe(false);
    expect(unlink?.disabled).toBe(false);
    expect(leave?.disabled).toBe(false);
    expect(revoke?.disabled).toBe(false);
    expect(link?.disabled).toBe(false);
    expect(botSelect?.disabled).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("waits to save conversation settings until another action finishes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  emptyResponses();
  const pending = deferred<unknown>();
  messaging.channels.mockResolvedValue([
    { id: "channel-1", identityId: "identity-1", name: "Demo", status: "invited", memberCount: 1 },
  ]);
  messaging.respond.mockReturnValue(pending.promise);
  spacesList.mockResolvedValue({
    current: {
      externalConversations: [
        {
          id: "conversation-1",
          botId: "bot-1",
          provider: "slack",
          displayName: "Room",
          participantNames: [],
          teamChatAmbientEnabled: null,
          teamChatRules: null,
          automatedSenderPolicies: {},
          automatedSenders: [],
        },
      ],
    },
  });
  botsList.mockResolvedValue([
    { id: "bot-1", name: "Demo bot", teamChatAmbientEnabled: true, teamChatRules: "" },
  ]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MessagingSettingsOverlay onClose={() => undefined} />));
    const click = (label: string) =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === label)
        ?.click();
    await act(async () => click("Approve"));
    await act(async () => click("Settings"));
    let save!: (policy: unknown) => Promise<void>;
    await act(async () => {
      save = messaging.onSave.mock.calls.at(-1)?.[0];
    });
    let savePromise!: Promise<void>;
    await act(async () => {
      savePromise = save({});
      await Promise.resolve();
    });
    expect(messaging.updatePolicy).not.toHaveBeenCalled();
    await act(async () => pending.resolve(undefined));
    await act(async () => savePromise);
    expect(messaging.updatePolicy).toHaveBeenCalledTimes(1);
  } finally {
    pending.reject(new Error("cleanup"));
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("restores focus to the action button after an action fails", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  emptyResponses();
  messaging.channels.mockResolvedValue([
    { id: "channel-1", identityId: "identity-1", name: "Demo", status: "invited", memberCount: 1 },
  ]);
  const pending = deferred<unknown>();
  messaging.respond.mockReturnValue(pending.promise);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MessagingSettingsOverlay onClose={() => undefined} />));
    const approve = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Approve",
    );
    approve?.focus();
    await act(async () => approve?.click());
    document.body.tabIndex = -1;
    document.body.focus();
    await act(async () => pending.reject(new Error("offline")));
    expect(container.textContent).toContain("Couldn't update messaging settings");
    expect(document.activeElement).toBe(approve);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("keeps a displayed link code when conversation settings are saved", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  emptyResponses();
  messaging.linkStart.mockResolvedValue({ code: "LINK-123" });
  messaging.updatePolicy.mockResolvedValue(undefined);
  spacesList.mockResolvedValue({
    current: {
      externalConversations: [
        {
          id: "conversation-1",
          botId: "bot-1",
          provider: "slack",
          displayName: "Room",
          participantNames: [],
          teamChatAmbientEnabled: null,
          teamChatRules: null,
          automatedSenderPolicies: {},
          automatedSenders: [],
        },
      ],
    },
  });
  botsList.mockResolvedValue([
    { id: "bot-1", name: "Demo bot", teamChatAmbientEnabled: true, teamChatRules: "" },
  ]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MessagingSettingsOverlay onClose={() => undefined} />));
    await act(async () => {
      const select = container.querySelector("select")!;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
        select,
        "bot-1",
      );
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Link a chat app")
        ?.click(),
    );
    expect(container.textContent).toContain("LINK-123");
    let save!: (policy: unknown) => Promise<void>;
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Settings")
        ?.click();
    });
    save = messaging.onSave.mock.calls.at(-1)?.[0];
    await act(async () => save({}));
    expect(messaging.updatePolicy).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("LINK-123");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

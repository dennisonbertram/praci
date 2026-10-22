// @vitest-environment jsdom

import type { AiConsentStatus } from "@rakazo/contracts";
import { AI_DATA_DISCLOSURES } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((text, part, index) => text + String(values[index - 1] ?? "") + part),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core", () => ({ i18n: { _: (text: string) => text } }));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Skeleton: (props: React.ComponentProps<"div">) => <div data-skeleton {...props} />,
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  cn: (...names: unknown[]) => names.filter(Boolean).join(" "),
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.ComponentProps<"button">) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

const consent = vi.hoisted(() => ({
  allowRecipient: vi.fn(),
  revokeRecipient: vi.fn(),
  aiConsentStatus: vi.fn(),
  documentConsent: vi.fn(),
  allowDocuments: vi.fn(),
}));
vi.mock("../lib/ai-consent", () => consent);
vi.mock("../lib/user-error", () => ({
  errorText: (cause: unknown) => (cause instanceof Error ? cause.message : "Something went wrong"),
}));

import { AiDataSharingSection, InboxConsentPrompt } from "./AiDataSharing";

const recipients: AiConsentStatus["recipients"] = [
  { key: "model-key", name: "OpenRouter", use: "model", detail: "vendor/model", allowed: true },
  { key: "typesafe-key", name: "TypeSafe", use: "model", detail: "", allowed: false },
  { key: "voice-key", name: "ElevenLabs", use: "voice", detail: "", allowed: true },
];
const statusOf = (list = recipients): AiConsentStatus => ({
  scope: "s",
  version: "v",
  recipients: list,
});

const documents = (hasModel: boolean, allowed: boolean) => ({
  key: "data-room:k",
  version: "d1",
  allowed,
  disclosure: "",
  recipients: hasModel ? [{ name: "OpenRouter", detail: "vendor/model" }] : [],
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  consent.documentConsent.mockResolvedValue(documents(false, false));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = (node: ReactNode) => act(async () => root.render(node));
const click = (element: Element | null) => act(async () => (element as HTMLElement).click());

it("names the recipient and allows exactly its key when the user presses Allow", async () => {
  consent.allowRecipient.mockResolvedValue(statusOf());
  const onAllowed = vi.fn();
  await render(
    <InboxConsentPrompt
      recipient={{ key: "model-key", name: "OpenRouter" }}
      onAllowed={onAllowed}
    />,
  );

  expect(container.querySelector("h2")?.textContent).toBe("Let Praci sort your mail");
  // One sentence naming what is sent, with no vendor name in it.
  expect(container.textContent).toContain(
    "The sender, subject and a preview of each message are sent to the AI model that runs your bots.",
  );
  expect(container.textContent).not.toContain("OpenRouter");
  expect(onAllowed).not.toHaveBeenCalled();
  expect(consent.allowRecipient).not.toHaveBeenCalled();

  await click(container.querySelector("button"));

  expect(consent.allowRecipient).toHaveBeenCalledExactlyOnceWith("model-key");
  expect(onAllowed).toHaveBeenCalledTimes(1);
});

it("Not now dismisses without allowing", async () => {
  const onAllowed = vi.fn();
  const onDismiss = vi.fn();
  await render(
    <InboxConsentPrompt
      recipient={{ key: "model-key", name: "OpenRouter" }}
      onAllowed={onAllowed}
      onDismiss={onDismiss}
    />,
  );
  const notNow = [...container.querySelectorAll("button")].find((b) => b.textContent === "Not now");
  await click(notNow ?? null);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(consent.allowRecipient).not.toHaveBeenCalled();
  expect(onAllowed).not.toHaveBeenCalled();
});

it("shows the error and does not report consent when allowing fails", async () => {
  consent.allowRecipient.mockRejectedValue(new Error("AI data sharing changed. Review it again."));
  const onAllowed = vi.fn();
  await render(
    <InboxConsentPrompt
      recipient={{ key: "model-key", name: "OpenRouter" }}
      onAllowed={onAllowed}
    />,
  );

  await click(container.querySelector("button"));

  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "AI data sharing changed. Review it again.",
  );
  expect(onAllowed).not.toHaveBeenCalled();
  expect(container.querySelector("button")?.disabled).toBe(false);
});

const modelA = { key: "a", name: "OpenRouter", use: "model", detail: "vendor/alpha, x" } as const;
const modelB = { key: "b", name: "OpenRouter", use: "model", detail: "vendor/beta, x" } as const;
const switchStates = () =>
  [...container.querySelectorAll('[role="switch"]')].map((s) => [
    s.getAttribute("aria-label"),
    s.getAttribute("aria-checked"),
  ]);

it("shows one switch for every model, on only when all are allowed, with the models under Advanced", async () => {
  consent.aiConsentStatus.mockResolvedValue(statusOf());
  await render(<AiDataSharingSection />);

  expect(switchStates()).toEqual([
    ["Allow AI models", "false"],
    ["Model", "true"],
    ["TypeSafe", "false"],
  ]);
  expect(container.querySelector("details")?.textContent).toContain("Advanced");
  expect(container.textContent).toContain(AI_DATA_DISCLOSURES.model);
  expect(container.textContent).not.toContain("ElevenLabs");
});

it("shows the one switch off when only some models are allowed (Advanced opens to show which), on when all are", async () => {
  consent.aiConsentStatus.mockResolvedValue(
    statusOf([
      { ...modelA, allowed: true },
      { ...modelB, allowed: false },
    ]),
  );
  await render(<AiDataSharingSection />);
  expect(switchStates()[0]).toEqual(["Allow AI models", "false"]);
  expect(container.querySelector("details")?.open).toBe(true);

  consent.aiConsentStatus.mockResolvedValue(
    statusOf([
      { ...modelA, allowed: true },
      { ...modelB, allowed: true },
    ]),
  );
  await render(<AiDataSharingSection key="all" />);
  expect(switchStates()[0]).toEqual(["Allow AI models", "true"]);
  expect(container.querySelector("details")?.open).toBe(false);
});

it("holds its place with a skeleton until the status loads", async () => {
  let resolve: (status: AiConsentStatus) => void = () => undefined;
  consent.aiConsentStatus.mockReturnValue(new Promise((r) => (resolve = r)));
  await render(<AiDataSharingSection />);
  expect(container.querySelector("[data-skeleton]")).not.toBeNull();
  await act(async () => resolve(statusOf()));
  expect(container.querySelector("[data-skeleton]")).toBeNull();
});

it("shows a model slug as its display name under Advanced, so two models are told apart", async () => {
  consent.aiConsentStatus.mockResolvedValue(
    statusOf([
      { ...modelA, detail: "vendor/gpt-6-luna, x", allowed: true },
      { ...modelB, detail: "vendor/muse-spark-1.2", allowed: false },
    ]),
  );
  await render(<AiDataSharingSection />);
  expect([...container.querySelectorAll("li")].map((r) => r.textContent)).toEqual([
    "GPT-6 Luna",
    "Muse Spark 1.2",
  ]);
  expect(container.textContent).not.toContain("OpenRouter");
});

it("allows every model with the one switch and revokes every model when it is turned off", async () => {
  const list = (allowed: boolean) =>
    statusOf([
      { ...modelA, allowed },
      { ...modelB, allowed },
    ]);
  consent.aiConsentStatus.mockResolvedValue(list(false));
  consent.allowRecipient.mockResolvedValue(list(true));
  consent.revokeRecipient.mockResolvedValue(list(false));
  await render(<AiDataSharingSection />);

  await click(container.querySelector('[aria-label="Allow AI models"]'));
  expect(consent.allowRecipient.mock.calls).toEqual([["a"], ["b"]]);
  expect(switchStates()[0]).toEqual(["Allow AI models", "true"]);

  await click(container.querySelector('[aria-label="Allow AI models"]'));
  expect(consent.revokeRecipient.mock.calls).toEqual([["a"], ["b"]]);
  expect(switchStates()[0]).toEqual(["Allow AI models", "false"]);
});

it("changes only one model from its switch under Advanced", async () => {
  consent.aiConsentStatus.mockResolvedValue(statusOf());
  consent.revokeRecipient.mockResolvedValue(
    statusOf(recipients.map((r) => (r.key === "model-key" ? { ...r, allowed: false } : r))),
  );
  await render(<AiDataSharingSection />);
  await click(container.querySelector('[aria-label="Model"]'));
  expect(consent.revokeRecipient).toHaveBeenCalledExactlyOnceWith("model-key");
  expect(consent.allowRecipient).not.toHaveBeenCalled();
});

it("tells an open Inbox to reload once a switch changes", async () => {
  consent.aiConsentStatus.mockResolvedValue(statusOf());
  consent.allowRecipient.mockResolvedValue(statusOf());
  const changed = vi.fn();
  window.addEventListener("rakazo:inbox-changed", changed);
  await render(<AiDataSharingSection />);
  expect(changed).not.toHaveBeenCalled();
  await click(container.querySelector('[aria-label="Allow AI models"]'));
  expect(changed).toHaveBeenCalledTimes(1);
  window.removeEventListener("rakazo:inbox-changed", changed);
});

it("renders nothing when there are no model recipients or the status cannot load", async () => {
  consent.aiConsentStatus.mockResolvedValue(
    statusOf([recipients[2] as AiConsentStatus["recipients"][number]]),
  );
  await render(<AiDataSharingSection />);
  expect(container.innerHTML).toBe("");

  consent.aiConsentStatus.mockRejectedValue(new Error("offline"));
  await render(<AiDataSharingSection key="again" />);
  expect(container.innerHTML).toBe("");
});

it("sends one grant even if Allow is pressed again while the first is in flight", async () => {
  let finish: (value: AiConsentStatus) => void = () => {};
  consent.allowRecipient.mockReturnValue(
    new Promise<AiConsentStatus>((resolve) => (finish = resolve)),
  );
  await render(
    <InboxConsentPrompt recipient={{ key: "model-key", name: "OpenRouter" }} onAllowed={vi.fn()} />,
  );

  await click(container.querySelector("button"));
  await click(container.querySelector("button"));
  expect(container.querySelector("button")?.disabled).toBe(true);
  expect(consent.allowRecipient).toHaveBeenCalledTimes(1);

  await act(async () => finish(statusOf()));
  expect(container.querySelector("button")?.disabled).toBe(false);
});

it("reads off until the documents are allowed too, and the switch then allows them with the models", async () => {
  const list = (allowed: boolean) =>
    statusOf([
      { ...modelA, allowed },
      { ...modelB, allowed },
    ]);
  consent.aiConsentStatus.mockResolvedValue(list(true));
  consent.documentConsent.mockResolvedValue(documents(true, false));
  await render(<AiDataSharingSection />);
  expect(switchStates()[0]).toEqual(["Allow AI models", "false"]);
  expect(container.querySelector("details")?.open).toBe(true);

  consent.allowRecipient.mockResolvedValue(list(true));
  consent.allowDocuments.mockResolvedValue(documents(true, true));
  consent.documentConsent.mockResolvedValue(documents(true, true));
  await click(container.querySelector('[aria-label="Allow AI models"]'));
  expect(consent.allowDocuments).toHaveBeenCalledTimes(1);
  expect(switchStates()[0]).toEqual(["Allow AI models", "true"]);
});

it("allows only the documents from their own switch, and turning the master off revokes them", async () => {
  const models = statusOf([{ ...modelA, allowed: true }]);
  consent.aiConsentStatus.mockResolvedValue(models);
  consent.documentConsent.mockResolvedValue(documents(true, false));
  consent.allowDocuments.mockResolvedValue(documents(true, true));
  await render(<AiDataSharingSection />);
  consent.documentConsent.mockResolvedValue(documents(true, true));
  await click(container.querySelector('[aria-label="Documents"]'));
  expect(consent.allowDocuments).toHaveBeenCalledTimes(1);
  expect(consent.allowRecipient).not.toHaveBeenCalled();
  expect(switchStates()[0]).toEqual(["Allow AI models", "true"]);

  consent.revokeRecipient.mockResolvedValue(statusOf([{ ...modelA, allowed: false }]));
  consent.documentConsent.mockResolvedValue(documents(true, false));
  await click(container.querySelector('[aria-label="Allow AI models"]'));
  expect(consent.revokeRecipient.mock.calls).toEqual([["a"], ["data-room:k"]]);
  expect(switchStates()[0]).toEqual(["Allow AI models", "false"]);
});

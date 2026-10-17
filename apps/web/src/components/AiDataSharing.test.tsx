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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
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

  expect(container.querySelector("h2")?.textContent).toBe("Let Rakazo sort your mail");
  // The recipient stays named, so consent stays accurate.
  expect(container.textContent).toContain(
    "Senders, recipients, subjects and short previews are sent to the AI service that runs your bots (OpenRouter).",
  );
  expect(onAllowed).not.toHaveBeenCalled();
  expect(consent.allowRecipient).not.toHaveBeenCalled();

  await click(container.querySelector("button"));

  expect(consent.allowRecipient).toHaveBeenCalledExactlyOnceWith("model-key");
  expect(onAllowed).toHaveBeenCalledTimes(1);
});

it("says what sorting gives, and Not now dismisses without allowing", async () => {
  const onAllowed = vi.fn();
  const onDismiss = vi.fn();
  await render(
    <InboxConsentPrompt
      recipient={{ key: "model-key", name: "OpenRouter" }}
      onAllowed={onAllowed}
      onDismiss={onDismiss}
    />,
  );
  expect(container.textContent).toContain("finds what needs a reply");
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

it("lists only model recipients, each off until the user turns it on, with the shared disclosure", async () => {
  consent.aiConsentStatus.mockResolvedValue(statusOf());
  await render(<AiDataSharingSection />);

  const switches = [...container.querySelectorAll('[role="switch"]')];
  expect(
    switches.map((s) => [s.getAttribute("aria-label"), s.getAttribute("aria-checked")]),
  ).toEqual([
    ["Allow OpenRouter", "true"],
    ["Allow TypeSafe", "false"],
  ]);
  expect(container.textContent).toContain(AI_DATA_DISCLOSURES.model);
  // Says what a switch covers, so Off while bots still answer does not look broken.
  expect(container.textContent).toContain("Each switch covers one AI service.");
  expect(container.textContent).not.toContain("ElevenLabs");
});

it("revokes only the switched-off recipient and allows only the switched-on one", async () => {
  consent.aiConsentStatus.mockResolvedValue(statusOf());
  consent.revokeRecipient.mockResolvedValue(
    statusOf(recipients.map((r) => (r.key === "model-key" ? { ...r, allowed: false } : r))),
  );
  consent.allowRecipient.mockResolvedValue(
    statusOf(recipients.map((r) => (r.key === "typesafe-key" ? { ...r, allowed: true } : r))),
  );
  await render(<AiDataSharingSection />);

  await click(container.querySelector('[aria-label="Allow OpenRouter"]'));
  expect(consent.revokeRecipient).toHaveBeenCalledExactlyOnceWith("model-key");
  expect(consent.allowRecipient).not.toHaveBeenCalled();
  expect(
    container.querySelector('[aria-label="Allow OpenRouter"]')?.getAttribute("aria-checked"),
  ).toBe("false");

  await click(container.querySelector('[aria-label="Allow TypeSafe"]'));
  expect(consent.allowRecipient).toHaveBeenCalledExactlyOnceWith("typesafe-key");
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

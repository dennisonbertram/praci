// @vitest-environment jsdom

import type { DataRoomConsentStatus } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  cn: (...names: unknown[]) => names.filter(Boolean).join(" "),
}));
vi.mock("../../lib/user-error", () => ({
  errorText: (cause: unknown) => (cause instanceof Error ? cause.message : "Something went wrong"),
}));
const rpc = vi.hoisted(() => ({ consent: vi.fn(), consentGrant: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { dataRoom: rpc } }));

import { DataRoomConsentPrompt } from "./ConsentPrompt";

const status = (over: Partial<DataRoomConsentStatus> = {}): DataRoomConsentStatus => ({
  key: "data-room:abc",
  version: "2026-10-22",
  allowed: false,
  disclosure: "",
  recipients: [{ name: "Example Model", detail: "example/model" }],
  ...over,
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
  localStorage.clear();
  vi.unstubAllGlobals();
});

const render = (onAllowed = vi.fn()) =>
  act(async () => root.render(<DataRoomConsentPrompt onAllowed={onAllowed} />));

it("names where documents go and grants exactly the shown key and version on Allow", async () => {
  rpc.consent.mockResolvedValue(status());
  rpc.consentGrant.mockResolvedValue(status({ allowed: true }));
  const onAllowed = vi.fn();
  await render(onAllowed);
  expect(container.textContent).toContain("The text is sent to the AI model that runs your bots.");
  await act(async () => container.querySelector("button")?.click());
  expect(rpc.consentGrant).toHaveBeenCalledExactlyOnceWith({
    key: "data-room:abc",
    version: "2026-10-22",
  });
  expect(onAllowed).toHaveBeenCalledTimes(1);
  // Allowed: the card goes away and one line says what changed.
  expect(container.textContent).toBe("Praci can now read your documents.");
});

it("shows why the grant failed and keeps asking", async () => {
  rpc.consent.mockResolvedValue(status());
  rpc.consentGrant.mockRejectedValue(new Error("AI data sharing changed. Review it again."));
  const onAllowed = vi.fn();
  await render(onAllowed);
  await act(async () => container.querySelector("button")?.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "AI data sharing changed. Review it again.",
  );
  expect(onAllowed).not.toHaveBeenCalled();
});

it("says documents are searchable but not tagged when no model is set up, with nothing to allow", async () => {
  rpc.consent.mockResolvedValue(status({ recipients: [] }));
  await render();
  expect(container.textContent).toContain("search documents by name and text");
  expect(container.textContent).toContain("move them into folders yourself");
  expect(container.querySelector("button")).toBeNull();
});

it("shows nothing once allowed", async () => {
  rpc.consent.mockResolvedValue(status({ allowed: true }));
  await render();
  expect(container.textContent).toBe("");
});

it("shrinks to one line on Not now, without allowing, with a way to be asked again", async () => {
  rpc.consent.mockResolvedValue(status());
  const onAllowed = vi.fn();
  await render(onAllowed);
  const notNow = [...container.querySelectorAll("button")].find((b) => b.textContent === "Not now");
  await act(async () => notNow?.click());
  expect(container.textContent).not.toContain(
    "The text is sent to the AI model that runs your bots.",
  );
  expect(rpc.consentGrant).not.toHaveBeenCalled();
  expect(onAllowed).not.toHaveBeenCalled();
  const askAgain = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Let Praci read documents",
  );
  await act(async () => askAgain?.click());
  expect(container.textContent).toContain("The text is sent to the AI model that runs your bots.");
  expect(localStorage.getItem("rakazo.dataRoomConsentDismissed")).toBeNull();
});

it("remembers Not now across visits, and asks again for a new version", async () => {
  rpc.consent.mockResolvedValue(status());
  await render();
  const notNow = [...container.querySelectorAll("button")].find((b) => b.textContent === "Not now");
  await act(async () => notNow?.click());
  await act(async () => root.unmount());
  root = createRoot(container);
  await render();
  expect(container.textContent).not.toContain(
    "The text is sent to the AI model that runs your bots.",
  );

  await act(async () => root.unmount());
  root = createRoot(container);
  rpc.consent.mockResolvedValue(status({ version: "2027-01-01" }));
  await render();
  expect(container.textContent).toContain("Let Praci read your documents");
});

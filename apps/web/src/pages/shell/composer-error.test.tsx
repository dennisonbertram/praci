// @vitest-environment jsdom

import {
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_MODEL_REQUIRED_MESSAGE,
  MISSING_TOOL_FINAL_RESPONSE_ERROR,
} from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});

import { runErrorText } from "../../lib/user-error";
import { ComposerError } from "./composer-error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const settingsButton = () =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === "Open Models settings");

it("offers OpenRouter's Models settings for the Legal model error", async () => {
  const open = vi.fn();
  await act(async () =>
    root.render(
      <ComposerError
        message={LEGAL_MODEL_REQUIRED_MESSAGE}
        onDismiss={() => {}}
        onOpenModelSettings={open}
      />,
    ),
  );
  expect(container.textContent).toContain("needs your own OpenRouter key");
  await act(async () => settingsButton()?.click());
  expect(open).toHaveBeenCalledWith("openrouter");
});

it("offers Models settings when the provider did not accept the API key", async () => {
  const open = vi.fn();
  await act(async () =>
    root.render(
      <ComposerError
        message={runErrorText('401: {"message":"User not found.","code":401}')}
        onDismiss={() => {}}
        onOpenModelSettings={open}
      />,
    ),
  );
  expect(container.textContent).toContain("did not accept your API key");
  await act(async () => settingsButton()?.click());
  // "" opens the default provider with its key field focused.
  expect(open).toHaveBeenCalledWith("");
});

it("shows any other error with only Dismiss", async () => {
  const dismiss = vi.fn();
  await act(async () =>
    root.render(
      <ComposerError message="Network down" onDismiss={dismiss} onOpenModelSettings={() => {}} />,
    ),
  );
  expect(settingsButton()).toBeUndefined();
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="Dismiss error"]')?.click(),
  );
  expect(dismiss).toHaveBeenCalledTimes(1);
});

const pageButton = (label: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === label);

it("offers Allow, which opens the Legal page, when consent is missing", async () => {
  const navigate = vi.fn();
  await act(async () =>
    root.render(
      <ComposerError
        message={LEGAL_CONSENT_REQUIRED_MESSAGE}
        onDismiss={() => {}}
        onNavigate={navigate}
      />,
    ),
  );
  expect(container.textContent).not.toContain("OpenRouter");
  await act(async () => pageButton("Allow")?.click());
  expect(navigate).toHaveBeenCalledWith("/app/legal");
});

it("has no page button for other errors", async () => {
  await act(async () =>
    root.render(
      <ComposerError message="Network down" onDismiss={() => {}} onNavigate={() => {}} />,
    ),
  );
  expect(pageButton("Allow")).toBeUndefined();
});

it("offers Retry, and a 24 px dismiss target, when a run ended without a reply", async () => {
  const retry = vi.fn();
  await act(async () =>
    root.render(
      <ComposerError
        message={MISSING_TOOL_FINAL_RESPONSE_ERROR}
        onDismiss={() => {}}
        onRetry={retry}
      />,
    ),
  );
  await act(async () => pageButton("Retry")?.click());
  expect(retry).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[aria-label="Dismiss error"]')?.className).toContain("size-6");
});

it("has no Retry for other errors", async () => {
  await act(async () =>
    root.render(<ComposerError message="Network down" onDismiss={() => {}} onRetry={() => {}} />),
  );
  expect(pageButton("Retry")).toBeUndefined();
});

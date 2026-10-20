// @vitest-environment jsdom

import { LEGAL_MODEL_REQUIRED_MESSAGE } from "@rakazo/contracts";
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

it.each([
  ["Legal", "/app/legal", "Allow it on the Legal page."],
  ["Data room", "/app/data-room", "Allow it on the Data room page."],
])("offers a button to the %s page when consent is missing", async (label, path, remedy) => {
  const navigate = vi.fn();
  await act(async () =>
    root.render(
      <ComposerError
        message={`Data Room consent is required for OpenRouter before the Legal agent can run. ${remedy}`}
        onDismiss={() => {}}
        onNavigate={navigate}
      />,
    ),
  );
  await act(async () => pageButton(`Open ${label}`)?.click());
  expect(navigate).toHaveBeenCalledWith(path);
});

it("has no page button for other errors", async () => {
  await act(async () =>
    root.render(
      <ComposerError message="Network down" onDismiss={() => {}} onNavigate={() => {}} />,
    ),
  );
  expect(pageButton("Open Legal")).toBeUndefined();
  expect(pageButton("Open Data room")).toBeUndefined();
});

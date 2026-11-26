// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: String.raw }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: String.raw }));
vi.mock("@rakazo/chat-ui/web", () => ({
  ChatMarkdown: ({ children }: { children: ReactNode }) => children,
}));

import type { AskBlock } from "./AskCard";
import { AskCard } from "./AskCard";

i18n.loadAndActivate({ locale: "en", messages: {} });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const block = (auth: { type: "bearer" } | { type: "login" }): AskBlock => ({
  kind: "ask",
  text: "Example access for the weekly report.",
  input: "secret",
  purpose: "api_key",
  credential: { name: "EXAMPLE_API_KEY", origin: "https://api.example.com", auth },
});

vi.useFakeTimers({ toFake: ["Date"] });
const roots: Root[] = [];
// Unmount each card so its dialog portal and focus trap do not leak into the next test.
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.innerHTML = "";
  // A card mounted right after an answer keeps its buttons off for a moment; move the clock on.
  vi.setSystemTime(Date.now() + 60_000);
});

async function setup(b: AskBlock, onAnswer = vi.fn(async () => undefined)) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <AskCard block={b} canAnswer onAnswer={onAnswer} />
      </I18nProvider>,
    ),
  );
  return { container, onAnswer };
}

const byText = (text: string, selector = "button,[role=tab]") =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent === text);

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

it("shows the name and one button, with no field until the dialog opens", async () => {
  const { container } = await setup(block({ type: "bearer" }));
  expect(container.textContent).toContain("EXAMPLE_API_KEY");
  expect(byText("Provide secret")).toBeTruthy();
  expect(document.querySelector("input")).toBeNull();
});

it("submits the value once, then does not render it", async () => {
  const { container, onAnswer } = await setup(block({ type: "bearer" }));
  await act(async () => byText("Provide secret")?.click());
  const input = document.querySelector<HTMLInputElement>('input[type="password"]');
  expect(input?.getAttribute("autocomplete")).toBe("off");
  const submit = byText("Submit") as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  await act(async () => type(input as HTMLInputElement, "example-value-123"));
  expect(submit.disabled).toBe(false);
  await act(async () => submit.click());
  expect(onAnswer).toHaveBeenCalledExactlyOnceWith("example-value-123", undefined);
  expect(document.body.innerHTML).not.toContain("example-value-123");
  expect(container.querySelector("input")).toBeNull();
});

it("switches to a textarea for multi line values", async () => {
  const { onAnswer } = await setup(block({ type: "bearer" }));
  await act(async () => byText("Provide secret")?.click());
  await act(async () => byText("Multi line")?.click());
  const area = document.querySelector<HTMLTextAreaElement>("textarea");
  expect(area).toBeTruthy();
  await act(async () => type(area as HTMLTextAreaElement, "line1\nline2"));
  await act(async () => (byText("Submit") as HTMLButtonElement).click());
  expect(onAnswer).toHaveBeenCalledWith("line1\nline2", undefined);
});

it("asks a login for a username as well", async () => {
  const { onAnswer } = await setup(block({ type: "login" }));
  await act(async () => byText("Provide secret")?.click());
  const [user, pass] = [...document.querySelectorAll<HTMLInputElement>("input")];
  expect(byText("Multi line")).toBeUndefined();
  await act(async () => type(user as HTMLInputElement, " ada "));
  await act(async () => type(pass as HTMLInputElement, "example-pass"));
  await act(async () => (byText("Submit") as HTMLButtonElement).click());
  expect(onAnswer).toHaveBeenCalledWith("example-pass", "ada");
});

it("opens with focus in the field to type into, not on the line toggle", async () => {
  await setup(block({ type: "bearer" }));
  await act(async () => byText("Provide secret")?.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(document.activeElement).toBe(document.querySelector('input[type="password"]'));
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.innerHTML = "";
  await setup(block({ type: "login" }));
  await act(async () => byText("Provide secret")?.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(document.activeElement).toBe(document.querySelector("input"));
});

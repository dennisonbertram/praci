// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const catalog = [
  {
    provider: "openrouter",
    providerName: "OpenRouter",
    id: "sample/large",
    label: "Sample Large",
    billing: "",
    auth: "api-key",
  },
  {
    provider: "openai-codex",
    providerName: "ChatGPT",
    id: "sample-codex",
    label: "Sample Codex",
    billing: "",
    auth: "oauth",
    subscription: true,
    signIn: "auth-url",
  },
];

const models = vi.hoisted(() => ({
  list: vi.fn(),
  setDefault: vi.fn(async () => ({ ok: true })),
  connect: vi.fn(),
}));
const startup = vi.hoisted(() => ({
  me: vi.fn(async () => ({ needsModel: true, defaultProvider: "openrouter", defaultModel: "" })),
  botsCreate: vi.fn(async () => ({ id: "bot-1" })),
  botsList: vi.fn(
    async (): Promise<Array<{ id: string; name: string; spawnKey: string | null }>> => [],
  ),
  onboardingStart: vi.fn(async () => ({})),
  promptFocus: vi.fn(async () => ({})),
  navigate: vi.fn(),
}));
const openRouter = vi.hoisted(() => ({ onConnected: undefined as undefined | (() => unknown) }));
const startOpenRouter = vi.hoisted(() => vi.fn());
const startChatGpt = vi.hoisted(() => vi.fn());
const chatGpt = vi.hoisted(() => ({ onFinished: undefined as undefined | (() => unknown) }));

vi.mock("../lib/rpc", () => ({
  selectedSpaceId: () => "space-1",
  rpc: {
    models,
    me: startup.me,
    integrationSetup: { get: vi.fn(async () => null) },
    bots: { create: startup.botsCreate, list: startup.botsList },
    onboarding: { start: startup.onboardingStart, promptFocus: startup.promptFocus },
  },
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => startup.navigate };
});
vi.mock("../lib/use-openrouter-signin", () => ({
  useOpenRouterSignIn: (options: { onConnected: () => unknown }) => {
    openRouter.onConnected = options.onConnected;
    return { pending: false, start: startOpenRouter };
  },
}));
vi.mock("../lib/use-model-oauth-signin", () => ({
  useModelOAuthSignIn: (options: { onFinished: () => unknown }) => {
    chatGpt.onFinished = options.onFinished;
    return {
      oauth: null,
      pasteCode: "",
      setPasteCode: vi.fn(),
      oauthPending: false,
      popupBlocked: false,
      cancelOAuthAttempt: vi.fn(),
      startSubscriptionSignIn: startChatGpt,
      submitOAuthCode: vi.fn(),
    };
  },
}));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce(
      (text, part, index) => `${text}${index > 0 ? String(values[index - 1]) : ""}${part}`,
      "",
    );
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children?: ReactNode }) => children,
    Plural: ({ one, other, value }: { one: string; other: string; value: number }) =>
      value === 1 ? one : other,
  };
});

import { OnboardingPage } from "./Onboarding";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((el) => el.textContent?.trim() === name);

beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  models.list.mockResolvedValue(catalog);
  startup.me.mockResolvedValue({
    needsModel: true,
    defaultProvider: "openrouter",
    defaultModel: "",
  });
  startup.botsCreate.mockResolvedValue({ id: "bot-1" });
  startup.botsList.mockResolvedValue([]);
  startup.onboardingStart.mockResolvedValue({});
  startup.promptFocus.mockResolvedValue({});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

it("keeps the first chat retryable when starting onboarding fails", async () => {
  startup.me.mockResolvedValue({
    needsModel: false,
    defaultProvider: "openrouter",
    defaultModel: "",
  });
  startup.onboardingStart.mockRejectedValueOnce(new Error("start failed"));
  await render();

  expect(button("Try again")).toBeTruthy();
  expect(container.textContent).toContain("start failed");
  expect(startup.navigate).not.toHaveBeenCalled();

  startup.botsList.mockResolvedValueOnce([
    { id: "bot-reused", name: "Other", spawnKey: "onboarding:first" },
  ]);
  await act(async () => button("Try again")?.click());

  expect(startup.navigate).toHaveBeenCalledTimes(1);
  expect(startup.navigate).toHaveBeenCalledWith("/app/bot-reused");
  expect(startup.botsCreate).toHaveBeenCalledTimes(1);
});

it("keeps the first chat retryable when the focus prompt fails", async () => {
  startup.me.mockResolvedValue({
    needsModel: false,
    defaultProvider: "openrouter",
    defaultModel: "",
  });
  startup.promptFocus.mockRejectedValueOnce(new Error("focus failed"));
  await render();

  expect(button("Try again")).toBeTruthy();
  expect(container.textContent).toContain("focus failed");
  expect(startup.navigate).not.toHaveBeenCalled();

  await act(async () => button("Try again")?.click());
  expect(startup.navigate).toHaveBeenCalledTimes(1);
  expect(startup.navigate).toHaveBeenCalledWith("/app/bot-1");
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

it("keeps startup failures recoverable without creating a bot", async () => {
  startup.me.mockRejectedValueOnce(new Error("offline"));
  await render();
  expect(container.textContent).toContain("Could not load");
  expect(button("Try again")).toBeTruthy();
  expect(startup.botsCreate).not.toHaveBeenCalled();

  await act(async () => {
    startup.me.mockResolvedValueOnce({
      needsModel: true,
      defaultProvider: "openrouter",
      defaultModel: "",
    });
    button("Try again")?.click();
  });
  expect(await button("Sign in with OpenRouter")).toBeTruthy();
  expect(startup.botsCreate).not.toHaveBeenCalled();
  expect(startup.me).toHaveBeenCalledTimes(2);
});

it("retries a failed model catalog load on the model step", async () => {
  models.list.mockRejectedValueOnce(new Error("offline"));
  await render();
  expect(container.textContent).toContain("Could not load");
  expect(button("Try again")).toBeTruthy();
  expect(button("Sign in with OpenRouter")).toBeUndefined();

  await act(async () => {
    models.list.mockResolvedValueOnce(catalog);
    button("Try again")?.click();
  });
  expect(button("Sign in with OpenRouter")).toBeTruthy();
  expect(startup.me).toHaveBeenCalledTimes(1);
  expect(models.list).toHaveBeenCalledTimes(2);
});

it("offers both sign-ins above the API key fields", async () => {
  await render();
  expect(button("Sign in with ChatGPT")).toBeTruthy();
  expect(button("Sign in with OpenRouter")).toBeTruthy();
  expect(container.querySelector("details")?.textContent).toContain("Use an API key instead");
  // Thinking and Advanced belong to Settings, not first run.
  expect(container.textContent).not.toMatch(/Thinking|Advanced/);
  expect(button("Continue")?.disabled).toBe(true);
});

it("starts the existing ChatGPT sign-in for the openai-codex provider", async () => {
  await render();
  await act(async () => button("Sign in with ChatGPT")?.click());
  expect(startChatGpt).toHaveBeenCalledWith({
    provider: "openai-codex",
    modelId: "sample-codex",
    thinkingLevel: null,
    label: "ChatGPT",
  });
});

it("shows a success state and enables Continue after OpenRouter sign-in, with no API key", async () => {
  await render();
  await act(async () => button("Sign in with OpenRouter")?.click());
  expect(startOpenRouter).toHaveBeenCalled();
  await act(async () => {
    await openRouter.onConnected?.();
  });
  expect(container.textContent).toContain("Signed in with OpenRouter");
  expect(button("Sign in with OpenRouter")).toBeUndefined();
  expect(button("Continue")?.disabled).toBe(false);
  await act(async () => button("Continue")?.click());
  expect(models.connect).not.toHaveBeenCalled();
  expect(models.setDefault).toHaveBeenCalledWith(
    expect.objectContaining({ provider: "openrouter", modelId: "sample/large" }),
  );
});

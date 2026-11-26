// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { Bot, ExternalConversation, ExternalConversationPolicy } from "@rakazo/contracts";
import type { ComponentProps } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@rakazo/ui-web", () => ({
  Button: (props: ComponentProps<"button">) => <button {...props} />,
}));

import { ExternalConversationSettings } from "./ExternalConversationSettings";

i18n.loadAndActivate({ locale: "en", messages: {} });

const bot = { id: "bot-a", name: "Scout", teamChatAmbientEnabled: true, teamChatRules: "" } as Bot;
const conversation = {
  id: "conversation-a",
  spaceId: "space-a",
  botId: bot.id,
  provider: "slack",
  displayName: "Room",
  participantNames: [],
  teamChatAmbientEnabled: null,
  teamChatRules: "Room rules",
  automatedSenderPolicies: { ci: { name: "Build notifier", mode: "rollup", rollupHours: 6 } },
  automatedSenders: [{ id: "ci", name: "Build notifier" }],
  threadId: "thread-a",
  preview: "",
  unread: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
} as ExternalConversation;

let container: HTMLDivElement;
let root: Root;
let onSave: ReturnType<typeof vi.fn<(policy: ExternalConversationPolicy) => Promise<void>>>;

async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ExternalConversationSettings conversation={conversation} bot={bot} onSave={onSave} />
      </I18nProvider>,
    ),
  );
}

function hoursInput(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Build notifier rollup hours"]',
  );
  if (!input) throw new Error("Missing rollup hours input");
  return input;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function clickSave(): Promise<void> {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
    item.textContent?.includes("Save"),
  );
  if (!button) throw new Error("Missing Save button");
  await act(async () => button.click());
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onSave = vi.fn<(policy: ExternalConversationPolicy) => Promise<void>>(async () => undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("ExternalConversationSettings", () => {
  it("keeps an empty hours draft editable and saves the typed replacement", async () => {
    await render();
    const input = hoursInput();
    await act(async () => setInputValue(input, ""));
    expect(hoursInput().value).toBe("");
    await act(async () => setInputValue(hoursInput(), "12"));
    await clickSave();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        automatedSenderPolicies: {
          ci: { name: "Build notifier", mode: "rollup", rollupHours: 12 },
        },
      }),
    );
  });

  it("restores the previous hours value when the draft is empty on blur", async () => {
    await render();
    const input = hoursInput();
    await act(async () => setInputValue(input, ""));
    await act(async () => {
      input.focus();
      input.blur();
    });
    expect(hoursInput().value).toBe("6");
  });

  it("normalizes empty, fractional, and out-of-range values before saving", async () => {
    await render();
    await act(async () => setInputValue(hoursInput(), ""));
    await clickSave();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        automatedSenderPolicies: { ci: { name: "Build notifier", mode: "rollup", rollupHours: 6 } },
      }),
    );

    await act(async () => setInputValue(hoursInput(), "not-a-number"));
    await clickSave();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        automatedSenderPolicies: { ci: { name: "Build notifier", mode: "rollup", rollupHours: 6 } },
      }),
    );

    await act(async () => setInputValue(hoursInput(), "0"));
    await clickSave();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        automatedSenderPolicies: { ci: { name: "Build notifier", mode: "rollup", rollupHours: 1 } },
      }),
    );

    await act(async () => setInputValue(hoursInput(), "3.5"));
    await clickSave();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        automatedSenderPolicies: { ci: { name: "Build notifier", mode: "rollup", rollupHours: 4 } },
      }),
    );

    await act(async () => setInputValue(hoursInput(), "900"));
    await clickSave();
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        automatedSenderPolicies: {
          ci: { name: "Build notifier", mode: "rollup", rollupHours: 720 },
        },
      }),
    );
  });

  it("drops an unfinished draft when switching sender modes", async () => {
    await render();
    await act(async () => setInputValue(hoursInput(), ""));
    const modeSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Build notifier handling"]',
    );
    if (!modeSelect) throw new Error("Missing sender mode select");
    await act(async () => {
      modeSelect.value = "ignore";
      modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      modeSelect.value = "rollup";
      modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(hoursInput().value).toBe("6");
  });

  it("disables every form control while saving and shows Saved only after resolution", async () => {
    let resolveSave: (() => void) | undefined;
    onSave.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    await render();
    await clickSave();
    const controls = [
      ...container.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
      >("input, textarea, select, button"),
    ];
    expect(controls.length).toBeGreaterThan(4);
    expect(controls.every((control) => control.matches(":disabled"))).toBe(true);
    expect(container.textContent).not.toContain("Saved");
    await act(async () => resolveSave?.());
    expect(container.textContent).toContain("Saved");
    await act(async () => setInputValue(hoursInput(), "9"));
    expect(container.textContent).not.toContain("Saved");
  });
});

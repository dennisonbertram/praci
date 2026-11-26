// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  updateDraft: vi.fn(),
  save: vi.fn(),
  testRun: vi.fn(),
  saveLogin: vi.fn(),
  skipLogin: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    skills: {
      get: api.get,
      updateDraft: api.updateDraft,
      save: api.save,
      testRun: api.testRun,
      skipLogin: api.skipLogin,
    },
    taughtSkills: { saveLogin: api.saveLogin, cancel: api.cancel },
  },
}));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => text + part + (values[index] ?? ""), "");
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    variant: _variant,
    size: _size,
    ...props
  }: ComponentProps<"button"> & {
    variant?: string;
    size?: string;
  }) => <button type="button" {...props} />,
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  Label: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
}));

import { SkillDraftCard } from "./SkillDraftCard";

const playbook = {
  whenToUse: "",
  inputs: [],
  steps: ['Type "alice".', "Press key: Tab.", 'Type "[redacted input]".'],
  howToCheck: "",
  whatToReturn: "",
  approvalBoundaries: "",
  failureHandling: "",
};
const block = {
  kind: "skill_draft" as const,
  skillId: "skill-1",
  name: "Sign in",
  goal: "Sign in",
  playbook,
  status: "draft" as const,
};
const skill = (patch: Record<string, unknown> = {}) => ({
  id: "skill-1",
  playbook,
  recording: { events: [], snapshots: [] },
  ...patch,
});

async function render() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SkillDraftCard block={block} onRefresh={async () => undefined} />);
  });
  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
  };
}

const button = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll("button")].find(
    (element) => element.textContent === label,
  ) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  api.updateDraft.mockResolvedValue({});
  api.testRun.mockResolvedValue({ runId: "run-1" });
});
afterEach(() => {
  vi.useRealTimers();
  for (const fn of Object.values(api)) fn.mockReset();
});

it("keeps polling a long test every 10 seconds until the result arrives, with Test off", async () => {
  api.get.mockResolvedValue(skill({ lastTestOutcome: null }));
  const view = await render();
  try {
    await act(async () => button(view.container, "Test").click());
    expect(button(view.container, "Test").disabled).toBe(true);
    // Past the first two minutes the card still says Testing and still polls.
    await act(async () => vi.advanceTimersByTimeAsync(130_000));
    expect(view.container.textContent).toContain("Testing…");
    expect(button(view.container, "Test").disabled).toBe(true);
    const before = api.get.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(api.get.mock.calls.length - before).toBe(3);
    api.get.mockResolvedValue(skill({ lastTestOutcome: "worked" }));
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(view.container.textContent).toContain("Worked");
    expect(button(view.container, "Test").disabled).toBe(false);
    const after = api.get.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(api.get.mock.calls.length).toBe(after);
  } finally {
    await view.cleanup();
  }
});

it("stops polling when the card unmounts", async () => {
  api.get.mockResolvedValue(skill({ lastTestOutcome: null }));
  const view = await render();
  await act(async () => button(view.container, "Test").click());
  await view.cleanup();
  const calls = api.get.mock.calls.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(api.get.mock.calls.length).toBe(calls);
});

it("prefills the suggested username and submits it explicitly", async () => {
  api.get.mockResolvedValue(
    skill({
      loginPrompts: [{ stepIndex: 2, field: "Password", username: "alice" }],
    }),
  );
  api.saveLogin.mockResolvedValue(skill());
  const view = await render();
  try {
    await act(async () => button(view.container, "Save as login").click());
    const input = (label: string) =>
      view.container.querySelector(
        `input[id^="login-${label.toLowerCase()}-"]`,
      ) as HTMLInputElement;
    expect(input("Username").value).toBe("alice");
    const set = async (element: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      await act(async () => {
        setter?.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    await set(input("Site"), "https://crm.example.test");
    await set(input("Name"), "CRM login");
    expect(view.container.textContent).toContain("Lowercase letters, numbers, - and _.");
    expect(button(view.container, "Save login").disabled).toBe(true);
    await set(input("Name"), "crm_example_test");
    expect(view.container.textContent).not.toContain("Lowercase letters");
    await act(async () => button(view.container, "Save login").click());
    expect(api.saveLogin).toHaveBeenCalledWith({
      skillId: "skill-1",
      stepIndex: 2,
      name: "crm_example_test",
      site: "https://crm.example.test",
      username: "alice",
    });
  } finally {
    await view.cleanup();
  }
});

it("discards a draft and shows Discarded", async () => {
  api.get.mockResolvedValue(skill());
  api.cancel.mockResolvedValue({ ok: true });
  const view = await render();
  try {
    await act(async () => button(view.container, "Discard").click());
    expect(api.cancel).toHaveBeenCalledWith({ skillId: "skill-1" });
    expect(view.container.textContent).toContain("Discarded");
  } finally {
    await view.cleanup();
  }
});

it("does not repeat Stopped when the note already starts with it", async () => {
  api.get.mockResolvedValue(
    skill({ lastTestOutcome: "stopped", lastTestNote: "Stopped at step 2: no Export button" }),
  );
  const view = await render();
  try {
    expect(view.container.textContent).toContain("Stopped at step 2: no Export button");
    expect(view.container.textContent).not.toContain("Stopped: Stopped");
  } finally {
    await view.cleanup();
  }
});

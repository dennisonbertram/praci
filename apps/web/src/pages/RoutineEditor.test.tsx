// @vitest-environment jsdom
import type { Routine } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/rpc", () => ({
  rpc: { models: { credentials: async () => [], list: async () => [] } },
}));

import { emptyRoutineDraft, RoutineEditor } from "./RoutineEditor";

async function buttons(editing: Routine | null) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  await act(async () =>
    root.render(
      <RoutineEditor
        draft={emptyRoutineDraft()}
        onChange={noop}
        editing={editing}
        timezone="America/New_York"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={noop}
        onClose={noop}
        onSave={noop}
        onTestRun={noop}
        onDelete={noop}
        onEnsureWebhook={async () => undefined}
      />,
    ),
  );
  const names = [...el.querySelectorAll("button")].map((button) => button.textContent);
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
  return names;
}

it("offers Delete only once the routine has been saved", async () => {
  expect(await buttons(null)).not.toContain("Delete");
  expect(await buttons({ id: "routine-1" } as Routine)).toContain("Delete");
});

it("asks when a new routine runs in plain words, without webhook or GitHub jargon", async () => {
  const names = await buttons(null);
  expect(names).toContain("Choose when it runs");
  expect(names).not.toContain("Add trigger");
});

it("lets an existing routine's time zone be changed in Advanced", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  const onChange = vi.fn();
  await act(async () =>
    root.render(
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), timezone: "America/Chicago" }}
        onChange={onChange}
        editing={{ id: "routine-1", timezone: "America/Chicago" } as Routine}
        timezone="America/Chicago"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={noop}
        onClose={noop}
        onSave={noop}
        onTestRun={noop}
        onDelete={noop}
        onEnsureWebhook={async () => undefined}
      />,
    ),
  );
  await act(async () => {
    (el.querySelector('button[aria-label="Advanced"]') as HTMLButtonElement).click();
  });
  const select = document.querySelector("select") as HTMLSelectElement;
  expect(select.value).toBe("America/Chicago");
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

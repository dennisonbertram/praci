// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { AgentSkillCatalogEntry, Routine } from "@rakazo/contracts";
import { PINNED_CONNECTION_LOST_MESSAGE } from "@rakazo/contracts";
import { presetFromCron } from "@rakazo/core";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const models = vi.hoisted(() => ({
  credentials: [] as unknown[] | Promise<unknown[]> | (() => Promise<unknown[]>),
  catalog: [] as unknown[] | Promise<unknown[]> | (() => Promise<unknown[]>),
  history: { runs: [], nextCursor: null } as unknown,
  resume: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    models: {
      credentials: () =>
        typeof models.credentials === "function"
          ? models.credentials()
          : Promise.resolve(models.credentials),
      list: () =>
        typeof models.catalog === "function" ? models.catalog() : Promise.resolve(models.catalog),
    },
    routines: {
      history: () => Promise.resolve(models.history),
      resume: models.resume,
    },
  },
}));

import type { RoutineDraftState } from "./RoutineEditor";
import {
  defaultRoutineName,
  draftFromRoutine,
  emptyRoutineDraft,
  RoutineEditor,
  RoutineListHeader,
  routineRunAtDate,
  routineStatusLine,
  routineTriggerSummary,
} from "./RoutineEditor";

i18n.loadAndActivate({ locale: "en", messages: {} });

function renderI18n(root: ReturnType<typeof createRoot>, children: ReactNode) {
  root.render(<I18nProvider i18n={i18n}>{children}</I18nProvider>);
}

async function buttons(editing: Routine | null) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  await act(async () =>
    renderI18n(
      root,
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
    renderI18n(
      root,
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

it("keeps Save off for a saved routine until a field changes, and shows its next run", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  const editing = {
    id: "routine-1",
    timezone: "America/Chicago",
    crons: ["0 9 * * 1"],
    nextRunAt: "2026-10-26T14:00:00.000Z",
    lastRunAt: null,
  } as Routine;
  const draft = { ...emptyRoutineDraft(), schedules: [presetFromCron("0 9 * * 1")] };
  const render = (next: typeof draft) =>
    act(async () =>
      renderI18n(
        root,
        <RoutineEditor
          draft={next}
          onChange={noop}
          editing={editing}
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
  const save = () =>
    [...el.querySelectorAll("button")].find((button) => button.textContent === "Save");
  await render(draft);
  expect(save()).toBeUndefined();
  // Nothing edited: the button keeps saying "Saved", not "Save", so a Test run does not look like an edit.
  const saved = [...el.querySelectorAll("button")].find((b) => b.textContent === "Saved");
  expect(saved?.disabled).toBe(true);
  expect(el.textContent).toContain("Next run");
  await render({ ...draft, name: "Monday cash check" });
  expect(save()?.disabled).toBe(false);
  // A rename keeps the saved run time; only a schedule change re-previews it.
  expect(el.textContent).toContain("Oct 26");
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("allows saving edits during a run while keeping Test run and Delete disabled", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const editing = {
    id: "routine-1",
    timezone: "UTC",
    crons: ["0 9 * * 1"],
    nextRunAt: "2026-10-26T09:00:00.000Z",
    lastRunAt: null,
  } as Routine;
  const initial = {
    ...emptyRoutineDraft(),
    schedules: [presetFromCron("0 9 * * 1")],
    name: "Routine",
  };
  const render = (draft: typeof initial) =>
    renderI18n(
      root,
      <RoutineEditor
        draft={draft}
        onChange={() => undefined}
        editing={editing}
        timezone="UTC"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={true}
        error={null}
        onBack={() => undefined}
        onClose={() => undefined}
        onSave={() => undefined}
        onTestRun={() => undefined}
        onDelete={() => undefined}
        onEnsureWebhook={async () => undefined}
      />,
    );
  await act(async () => render(initial));
  await act(async () => render({ ...initial, name: "Changed" }));
  const save = [...el.querySelectorAll("button")].find((button) => button.textContent === "Save");
  const testRun = [...el.querySelectorAll("button")].find(
    (button) => button.textContent === "Running…",
  );
  const deleteButton = [...el.querySelectorAll("button")].find(
    (button) => button.textContent === "Delete",
  );
  expect(save?.disabled).toBe(false);
  expect(testRun?.disabled).toBe(true);
  expect(deleteButton?.disabled).toBe(true);
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("asks before leaving a routine with an edited name", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const onBack = vi.fn();
  const initial = emptyRoutineDraft();
  const draft = { ...initial, name: "Edited name" };
  const renderDraft = (next: typeof draft) =>
    renderI18n(
      root,
      <RoutineEditor
        draft={next}
        onChange={() => undefined}
        editing={null}
        timezone="UTC"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={onBack}
        onClose={() => undefined}
        onSave={() => undefined}
        onTestRun={() => undefined}
        onDelete={() => undefined}
        onEnsureWebhook={async () => undefined}
      />,
    );
  await act(async () => renderDraft(initial));
  await act(async () => renderDraft(draft));
  await act(async () => {
    (el.querySelector('button[aria-label="Back"]') as HTMLButtonElement).click();
  });
  expect(el.textContent).toContain("Discard changes?");
  expect(onBack).not.toHaveBeenCalled();
  await act(async () => {
    [...el.querySelectorAll("button")].find((button) => button.textContent === "Discard")?.click();
  });
  expect(onBack).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("previews the next run after changing a recurring schedule", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const editing = {
    id: "routine-1",
    timezone: "UTC",
    crons: ["0 9 * * 1"],
    nextRunAt: "2026-10-26T09:00:00.000Z",
    lastRunAt: null,
  } as Routine;
  const initial = {
    ...emptyRoutineDraft(),
    active: true,
    timezone: "UTC",
    schedules: [presetFromCron("0 9 * * 1")],
  };
  const renderDraft = (draft: typeof initial) =>
    renderI18n(
      root,
      <RoutineEditor
        draft={draft}
        onChange={() => undefined}
        editing={editing}
        timezone="UTC"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={() => undefined}
        onClose={() => undefined}
        onSave={() => undefined}
        onTestRun={() => undefined}
        onDelete={() => undefined}
        onEnsureWebhook={async () => undefined}
      />,
    );
  await act(async () => renderDraft(initial));
  await act(async () => renderDraft({ ...initial, schedules: [presetFromCron("0 10 * * 1")] }));
  expect(el.textContent).toContain("Next run");
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("interprets a one-shot wall clock in its routine timezone", () => {
  expect(routineRunAtDate("2026-12-01T09:00", "Asia/Tokyo")?.toISOString()).toBe(
    "2026-12-01T00:00:00.000Z",
  );
});

it("labels the routine list's create button in words, visible without hovering", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  await act(async () => renderI18n(root, <RoutineListHeader empty onCreate={() => undefined} />));
  expect(el.querySelector("button")?.textContent).toBe("Create a routine");
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("adds the chosen skill to the instruction as an @mention", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  const onChange = vi.fn();
  const skills = [
    { id: "s1", name: "Weekly cash check", description: "", source: "user", readOnly: false },
  ] as AgentSkillCatalogEntry[];
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), prompt: "Every Monday." }}
        onChange={onChange}
        editing={null}
        timezone="America/New_York"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        skills={skills}
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
  const select = el.querySelector('select[aria-label="Add a skill"]') as HTMLSelectElement;
  expect(select).not.toBeNull();
  await act(async () => {
    select.value = "Weekly cash check";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ prompt: "@Weekly cash check Every Monday." }),
  );
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("shows a forced skill in the picker and keeps the instruction plain", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  const skills = [
    { id: "b1", name: "daily-brief", description: "", source: "builtin", readOnly: true },
    { id: "s1", name: "investor-update", description: "", source: "user", readOnly: false },
    { id: "p1", name: "ship-notes", description: "", source: "plugin", readOnly: true },
  ] as AgentSkillCatalogEntry[];
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), prompt: "@investor-update Draft the note." }}
        onChange={noop}
        editing={null}
        timezone="America/New_York"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        skills={skills}
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
  const select = el.querySelector('select[aria-label="Add a skill"]') as HTMLSelectElement;
  expect(select.value).toBe("investor-update");
  expect((el.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Draft the note.");
  expect(Array.from(select.options)[1]?.value).toBe("investor-update");
  const groupOf = (value: string) =>
    (select.querySelector(`option[value="${value}"]`) as HTMLElement).parentElement?.getAttribute(
      "label",
    );
  expect(groupOf("daily-brief")).toBe("Built-in");
  expect(groupOf("ship-notes")).toBe("Plugins");
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("keeps @mentions in the instruction when there are no skills to pick", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), prompt: "Send the update to @alice every Monday." }}
        onChange={noop}
        editing={null}
        timezone="America/New_York"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        skills={[]}
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
  expect((el.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
    "Send the update to @alice every Monday.",
  );
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

const baseRoutine = {
  crons: [],
  timezone: "UTC",
  active: true,
  webhookEnabled: false,
  githubEnabled: false,
  messageProvider: null,
  watch: null,
  managedKind: null,
  status: {
    lastRunAt: null,
    nextRunAt: null,
    lastCheckedAt: null,
    lastChangedAt: null,
    pausedReason: null,
  },
} as unknown as Routine;

it("describes a watch, a check-in and a pause in the row", () => {
  const now = new Date("2026-02-02T12:00:00Z");
  const watch = {
    ...baseRoutine,
    watch: { kind: "page", url: "https://example.com/pricing", intervalMinutes: 60 },
    status: {
      ...baseRoutine.status,
      lastCheckedAt: "2026-02-02T11:56:00Z",
      lastChangedAt: "2026-02-01T12:00:00Z",
    },
  } as Routine;
  expect(routineTriggerSummary(watch)).toBe("Watches example.com");
  expect(routineStatusLine(watch, "en", now)).toBe("Checked 4m ago · Changed 1d ago");
  const paused = { ...watch, status: { ...watch.status, pausedReason: "noisy" } } as Routine;
  expect(routineStatusLine(paused, "en", now)).toBe("Paused: the page changes too often");
  const checkIn = { ...baseRoutine, managedKind: "check_in", crons: ["0 9 * * *"] } as Routine;
  expect(routineTriggerSummary(checkIn)).toBe("Daily check-in");
  expect(routineTriggerSummary({ ...checkIn, crons: ["0 */4 * * *"] })).toBe(
    "Check-in every 4 hours",
  );
  const schedule = {
    ...baseRoutine,
    crons: ["0 8 * * *"],
    status: {
      ...baseRoutine.status,
      lastRunAt: "2026-02-02T08:00:00Z",
      nextRunAt: "2026-02-03T08:00:00Z",
    },
  } as Routine;
  expect(routineStatusLine(schedule, "en", now)).toBe("Last ran 8:00 AM · Next Tue 8:00 AM");
  expect(routineStatusLine(baseRoutine, "en", now)).toBeNull();
  const failed = { ...schedule, status: { ...schedule.status, lastRunFailed: true } } as Routine;
  expect(routineStatusLine(failed, "en", now)).toBe("Last run failed · Next Tue 8:00 AM");
  expect(routineStatusLine({ ...failed, active: false }, "en", now)).toBe("Last run failed");
  const failedWatch = { ...watch, status: { ...watch.status, lastRunFailed: true } } as Routine;
  expect(routineStatusLine(failedWatch, "en", now)).toBe(
    "Last run failed · Checked 4m ago · Changed 1d ago",
  );
  const failedPaused = { ...failedWatch, status: { ...failedWatch.status, pausedReason: "noisy" } };
  expect(routineStatusLine(failedPaused as Routine, "en", now)).toBe(
    "Paused: the page changes too often",
  );
});

it("describes a connected-app watch by its app, not a page", () => {
  const appWatch = {
    ...baseRoutine,
    watch: {
      kind: "connector",
      connectorId: "mcp",
      toolName: "mcp__bank__get_accounts",
      arguments: {},
      appName: "Bank",
      intervalMinutes: 60,
    },
    status: { ...baseRoutine.status, pausedReason: "errors" },
  } as Routine;
  expect(routineTriggerSummary(appWatch)).toBe("Watches Bank");
  expect(routineStatusLine(appWatch)).toBe("Paused: the app could not be checked");
});

it("says a timer routine is held because its model connection ran out of credit", () => {
  const held = { ...baseRoutine, status: { ...baseRoutine.status, pausedReason: "credit" } };
  expect(routineStatusLine(held as Routine)).toBe("Paused: model connection out of credit");
});

it("picks the connection's first model when a connection is chosen with no model yet", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  models.credentials = [
    { id: "c1", provider: "p1", label: "Key one", hasKey: true, isDefault: true },
    { id: "c2", provider: "p2", label: "Key two", hasKey: true, isDefault: false },
  ];
  models.catalog = [
    { provider: "p1", providerName: "P1", id: "m1", label: "M1", billing: "" },
    { provider: "p2", providerName: "P2", id: "m2", label: "M2", billing: "" },
  ];
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  const onChange = vi.fn();
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={emptyRoutineDraft()}
        onChange={onChange}
        editing={null}
        timezone="UTC"
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
  const select = document.querySelector('select[id$="-connection"]') as HTMLSelectElement;
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setValue.call(select, "c2");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ credentialId: "c2", modelKey: expect.stringContaining("m2") }),
  );
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
  models.credentials = [];
  models.catalog = [];
});

it("shows the routine explainer only while the bot has no routines", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  await act(async () => renderI18n(root, <RoutineListHeader empty onCreate={() => undefined} />));
  expect(el.querySelector("p")?.textContent).toContain("cash check every Monday");
  await act(async () =>
    renderI18n(root, <RoutineListHeader empty={false} onCreate={() => undefined} />),
  );
  expect(el.querySelector("p")).toBeNull();
  expect(el.querySelector("button")?.textContent).toBe("Create a routine");
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

describe("defaultRoutineName", () => {
  it("keeps a short instruction as is", () => {
    expect(defaultRoutineName("Check cash")).toBe("Check cash");
  });
  it("cuts a long instruction at a word with an ellipsis", () => {
    const name = defaultRoutineName(
      "Summarize every unread email from investors and draft replies",
    );
    expect(name).toBe("Summarize every unread email from…");
  });
  it("cuts a long word with no spaces at 40", () => {
    expect(defaultRoutineName("x".repeat(100))).toBe(`${"x".repeat(40)}…`);
  });
  it("uses the first non-empty line and collapses whitespace", () => {
    expect(defaultRoutineName("\n  \n Check   the\tcash \nthen email")).toBe("Check the cash");
  });
  it("falls back to the skill name, then Routine", () => {
    expect(defaultRoutineName("  ", "Weekly report")).toBe("Weekly report");
    expect(defaultRoutineName("")).toBe("Routine");
  });
  it("never exceeds 80 characters", () => {
    expect(defaultRoutineName("", "s".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

const inboundRoutine = {
  ...baseRoutine,
  name: "Inbound",
  prompt: "Check what arrived.",
  webhookEnabled: true,
} as Routine;

async function renderInbound(webhook: {
  path: string;
  secret: string | null;
  configured: boolean;
}) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  const onEnsureWebhook = vi.fn(async () => undefined);
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={draftFromRoutine(inboundRoutine)}
        onChange={noop}
        editing={inboundRoutine}
        timezone="UTC"
        webhook={webhook}
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
        onEnsureWebhook={onEnsureWebhook}
      />,
    ),
  );
  return { el, root, onEnsureWebhook };
}

function button(root: ParentNode, text: string) {
  return [...root.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  ) as HTMLButtonElement | undefined;
}

const clickIn = (element: HTMLElement | undefined) => act(async () => element?.click());

it("asks before rotating the webhook key and only rotates on confirm", async () => {
  const { el, root, onEnsureWebhook } = await renderInbound({
    path: "/hook",
    secret: null,
    configured: true,
  });
  await clickIn(button(el, "Rotate key"));
  expect(onEnsureWebhook).not.toHaveBeenCalled();

  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain("Rotate key?");
  expect(dialog?.textContent).toContain(
    "The current key stops working right away for webhooks and Git events.",
  );

  await clickIn(button(dialog!, "Cancel"));
  expect(onEnsureWebhook).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();

  await clickIn(button(el, "Rotate key"));
  await clickIn(button(document.querySelector('[role="alertdialog"]')!, "Rotate"));
  expect(onEnsureWebhook).toHaveBeenCalledTimes(1);

  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("copies a revealed webhook key", async () => {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  const { el, root } = await renderInbound({ path: "/hook", secret: "s3cret", configured: true });
  expect(el.querySelector('button[aria-label="Copy URL"]')).toBeDefined();
  await clickIn(el.querySelector('button[aria-label="Copy key"]') as HTMLButtonElement);
  expect(written).toEqual(["s3cret"]);
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
});

it("does not offer a copy button for a key it cannot show", async () => {
  const { el, root } = await renderInbound({ path: "/hook", secret: null, configured: true });
  expect(el.textContent).toContain("Saved. Rotate to reveal.");
  expect(el.querySelector('button[aria-label="Copy key"]')).toBeNull();
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});

it("copies the delivery URL once the routine is saved", async () => {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void written.push(text) },
  });
  const { el, root } = await renderInbound({ path: "/hook", secret: null, configured: true });
  await clickIn(el.querySelector('button[aria-label="Copy URL"]') as HTMLButtonElement);
  expect(written).toEqual(["/hook"]);
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "clipboard");
});

it("defaults a one-shot run time that is still in the future across a daylight-saving fall-back", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-10-31T00:30:00Z"));
  try {
    const draft = draftFromRoutine({
      ...({} as Routine),
      id: "once",
      name: "Once",
      timezone: "Europe/Berlin",
      crons: ["@once"],
      nextRunAt: null,
      lastRunAt: null,
    } as Routine);
    const at = routineRunAtDate(draft.runAtLocal, "Europe/Berlin");
    expect(at && at.getTime()).toBeGreaterThan(Date.now());
  } finally {
    vi.useRealTimers();
  }
});

it("does not report a pinned connection as removed when credentials fail to load", async () => {
  models.credentials = () => Promise.reject(new Error("offline"));
  models.catalog = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), credentialId: "credential-123" }}
        onChange={() => undefined}
        editing={null}
        timezone="UTC"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={() => undefined}
        onClose={() => undefined}
        onSave={() => undefined}
        onTestRun={() => undefined}
        onDelete={() => undefined}
        onEnsureWebhook={async () => undefined}
      />,
    ),
  );
  await act(async () => {
    (el.querySelector('button[aria-label="Advanced"]') as HTMLButtonElement).click();
  });
  expect(document.body.textContent).toContain("Could not load");
  expect(document.body.textContent).not.toContain("Signed out or removed");
  expect(document.body.textContent).toContain("Retry");
  expect(document.body.textContent).toContain("credential-123");
  await act(async () => root.unmount());
  el.remove();
  models.credentials = [];
  vi.unstubAllGlobals();
});

it("shows a removed pinned connection when credentials load but the catalog fails", async () => {
  models.credentials = [];
  models.catalog = () => Promise.reject(new Error("offline"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), credentialId: "credential-123" }}
        onChange={() => undefined}
        editing={null}
        timezone="UTC"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={() => undefined}
        onClose={() => undefined}
        onSave={() => undefined}
        onTestRun={() => undefined}
        onDelete={() => undefined}
        onEnsureWebhook={async () => undefined}
      />,
    ),
  );
  await act(async () =>
    (el.querySelector('button[aria-label="Advanced"]') as HTMLButtonElement).click(),
  );
  expect(document.body.textContent).toContain("Signed out or removed");
  expect(document.body.textContent).toContain("Could not load");
  await act(async () => root.unmount());
  el.remove();
  models.credentials = [];
  models.catalog = [];
  vi.unstubAllGlobals();
});

it("disables Retry while loading and updates the connection after a successful retry", async () => {
  let finishRetry!: (value: unknown[]) => void;
  let credentialRequest = 0;
  models.credentials = () => {
    credentialRequest += 1;
    if (credentialRequest === 1) return Promise.reject(new Error("offline"));
    return new Promise((resolve) => {
      finishRetry = resolve;
    });
  };
  models.catalog = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), credentialId: "credential-123" }}
        onChange={() => undefined}
        editing={null}
        timezone="UTC"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={() => undefined}
        onClose={() => undefined}
        onSave={() => undefined}
        onTestRun={() => undefined}
        onDelete={() => undefined}
        onEnsureWebhook={async () => undefined}
      />,
    ),
  );
  await act(async () =>
    (el.querySelector('button[aria-label="Advanced"]') as HTMLButtonElement).click(),
  );
  const retry = Array.from(document.body.querySelectorAll("button")).find(
    (button) => button.textContent === "Retry",
  );
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  expect(retry?.disabled).toBe(true);
  await act(async () => {
    finishRetry([
      {
        id: "credential-123",
        label: "Updated connection",
        provider: "openai",
        modelId: "gpt-4",
        authKind: "api_key",
      },
    ]);
    models.catalog = [];
  });
  expect(document.body.textContent).not.toContain("Could not load");
  expect(document.body.textContent).not.toContain("Retry");
  expect(document.body.textContent).toContain("Updated connection");
  await act(async () => root.unmount());
  el.remove();
  models.credentials = [];
  models.catalog = [];
  vi.unstubAllGlobals();
});

it("formats the next run using the active Lingui locale", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await act(async () => i18n.loadAndActivate({ locale: "de", messages: {} }));
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const editing = {
    id: "routine-locale",
    timezone: "UTC",
    crons: ["0 9 * * 1"],
    nextRunAt: "2026-10-26T09:00:00.000Z",
    lastRunAt: null,
  } as Routine;
  await act(async () =>
    renderI18n(
      root,
      <RoutineEditor
        draft={{ ...emptyRoutineDraft(), active: true, schedules: [presetFromCron("0 9 * * 1")] }}
        onChange={() => undefined}
        editing={editing}
        timezone="UTC"
        webhook={{ path: "/hook", secret: null, configured: false }}
        githubPath="/gh"
        messageProviders={[]}
        saving={false}
        running={false}
        error={null}
        onBack={() => undefined}
        onClose={() => undefined}
        onSave={() => undefined}
        onTestRun={() => undefined}
        onDelete={() => undefined}
        onEnsureWebhook={async () => undefined}
      />,
    ),
  );
  expect(el.textContent).toContain("Mo.");
  expect(el.textContent).not.toContain("Mon,");
  await act(async () => root.unmount());
  el.remove();
  await act(async () => i18n.loadAndActivate({ locale: "en", messages: {} }));
  vi.unstubAllGlobals();
});

const pausedWatchRoutine = {
  ...baseRoutine,
  id: "routine-paused",
  name: "Pricing page",
  prompt: "Tell me what changed.",
  watch: { kind: "page", url: "https://example.com/pricing", intervalMinutes: 60 },
  status: { ...baseRoutine.status, pausedReason: "noisy" },
} as unknown as Routine;

async function renderEditor(
  editing: Routine,
  draft: RoutineDraftState = draftFromRoutine(editing),
  props: Partial<ComponentProps<typeof RoutineEditor>> = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  const noop = () => undefined;
  const render = (next: RoutineDraftState) =>
    act(async () =>
      renderI18n(
        root,
        <RoutineEditor
          draft={next}
          onChange={noop}
          editing={editing}
          timezone="UTC"
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
          {...props}
        />,
      ),
    );
  await render(draft);
  return {
    el,
    render,
    close: async () => {
      await act(async () => root.unmount());
      el.remove();
      vi.unstubAllGlobals();
    },
  };
}

it("says why a system-paused routine stopped, only while a reason exists", async () => {
  const paused = await renderEditor(pausedWatchRoutine);
  try {
    expect(paused.el.querySelector('[data-testid="routine-paused-reason"]')?.textContent).toContain(
      "Paused: the page changes too often",
    );
  } finally {
    await paused.close();
  }
  const unpaused = {
    ...pausedWatchRoutine,
    status: { ...pausedWatchRoutine.status, pausedReason: null },
  } as Routine;
  const clean = await renderEditor(unpaused);
  try {
    expect(clean.el.querySelector('[data-testid="routine-paused-reason"]')).toBeNull();
  } finally {
    await clean.close();
  }
});

it("offers Models settings on the reason line of a credit-held routine", async () => {
  const held = {
    ...baseRoutine,
    id: "routine-credit",
    name: "Daily digest",
    prompt: "Summarize.",
    status: { ...baseRoutine.status, pausedReason: "credit" },
  } as Routine;
  const onOpenModelSettings = vi.fn();
  const view = await renderEditor(held, draftFromRoutine(held), { onOpenModelSettings });
  try {
    const line = view.el.querySelector('[data-testid="routine-paused-reason"]');
    expect(line?.textContent).toContain("Paused: model connection out of credit");
    const fix = [...(line?.querySelectorAll("button") ?? [])].find(
      (candidate) => candidate.textContent === "Open Models settings",
    ) as HTMLButtonElement | undefined;
    expect(fix).toBeDefined();
    await act(async () => fix?.click());
    expect(onOpenModelSettings).toHaveBeenCalledOnce();
  } finally {
    await view.close();
  }
});

it("offers Resume only on a system-paused routine, and clears the reason on success", async () => {
  const resumedWatch = {
    ...pausedWatchRoutine,
    status: { ...pausedWatchRoutine.status, pausedReason: null },
  } as Routine;
  const onResume = vi.fn();
  models.resume.mockResolvedValue(resumedWatch);
  const view = await renderEditor(pausedWatchRoutine, draftFromRoutine(pausedWatchRoutine), {
    onResume,
  });
  try {
    const line = view.el.querySelector('[data-testid="routine-paused-reason"]');
    expect(line?.textContent).toContain("Paused: the page changes too often");
    const resumeButton = [...(line?.querySelectorAll("button") ?? [])].find(
      (candidate) => candidate.textContent === "Resume",
    ) as HTMLButtonElement | undefined;
    expect(resumeButton).toBeDefined();
    await act(async () => resumeButton?.click());
    expect(models.resume).toHaveBeenCalledWith({ routineId: pausedWatchRoutine.id });
    expect(onResume).toHaveBeenCalledWith(resumedWatch);
    expect(view.el.querySelector('[data-testid="routine-paused-reason"]')).toBeNull();
  } finally {
    await view.close();
    models.resume.mockReset();
  }
  const clean = await renderEditor(resumedWatch);
  try {
    expect(clean.el.querySelector('[data-testid="routine-paused-reason"]')).toBeNull();
    expect(
      [...clean.el.querySelectorAll("button")].some(
        (candidate) => candidate.textContent === "Resume",
      ),
    ).toBe(false);
  } finally {
    await clean.close();
  }
});

it("keeps Open Models settings beside Resume on a credit-held routine", async () => {
  const held = {
    ...baseRoutine,
    id: "routine-credit",
    name: "Daily digest",
    prompt: "Summarize.",
    status: { ...baseRoutine.status, pausedReason: "credit" },
  } as Routine;
  models.resume.mockResolvedValue({
    ...held,
    status: { ...held.status, pausedReason: null },
  });
  const view = await renderEditor(held, draftFromRoutine(held), {
    onOpenModelSettings: () => undefined,
  });
  try {
    const line = view.el.querySelector('[data-testid="routine-paused-reason"]');
    const labels = [...(line?.querySelectorAll("button") ?? [])].map(
      (candidate) => candidate.textContent,
    );
    expect(labels).toContain("Resume");
    expect(labels).toContain("Open Models settings");
  } finally {
    await view.close();
    models.resume.mockReset();
  }
});

const failedConnectionRun = {
  id: "run-conn",
  botId: "bot-1",
  groupId: null,
  status: "failed",
  error: PINNED_CONNECTION_LOST_MESSAGE,
  createdAt: "2026-01-02T12:00:00Z",
  startedAt: "2026-01-02T12:00:00Z",
  completedAt: "2026-01-02T12:01:00Z",
  messageId: null,
};

it("asks before dropping a dirty draft when choosing another connection", async () => {
  models.history = { runs: [failedConnectionRun], nextCursor: null };
  const editing = {
    ...baseRoutine,
    id: "routine-conn",
    name: "Daily digest",
    prompt: "Summarize.",
    modelCredentialId: null,
  } as Routine;
  const onOpenBotSettings = vi.fn();
  const clean = draftFromRoutine(editing);
  const view = await renderEditor(editing, clean, { onOpenBotSettings });
  try {
    await view.render({ ...clean, name: "Edited" });
    const choose = button(view.el, "Choose another connection");
    expect(choose).toBeDefined();
    await clickIn(choose);
    expect(view.el.textContent).toContain("Discard changes?");
    expect(onOpenBotSettings).not.toHaveBeenCalled();
    await clickIn(button(view.el, "Discard"));
    expect(onOpenBotSettings).toHaveBeenCalledOnce();
  } finally {
    await view.close();
    models.history = { runs: [], nextCursor: null };
  }
});

it("does not offer choose-connection when the routine pins its own connection", async () => {
  models.history = { runs: [failedConnectionRun], nextCursor: null };
  const editing = {
    ...baseRoutine,
    id: "routine-pinned",
    name: "Daily digest",
    prompt: "Summarize.",
    modelCredentialId: "cred_1",
  } as Routine;
  const view = await renderEditor(editing, draftFromRoutine(editing), {
    onOpenModelSettings: () => undefined,
    onOpenBotSettings: () => undefined,
  });
  try {
    expect(view.el.textContent).toContain("Sign in again");
    expect(view.el.textContent).not.toContain("Choose another connection");
  } finally {
    await view.close();
    models.history = { runs: [], nextCursor: null };
  }
});

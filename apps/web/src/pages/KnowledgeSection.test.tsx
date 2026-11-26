// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const memoryList = vi.hoisted(() => vi.fn(async () => []));
const memoryUpdate = vi.hoisted(() => vi.fn());
const memoryRemove = vi.hoisted(() => vi.fn());
const botsList = vi.hoisted(() =>
  vi.fn(async () => [
    { id: "bot-a", name: "A" },
    { id: "bot-b", name: "B" },
  ]),
);
vi.mock("../lib/rpc", () => ({
  rpc: {
    memory: { list: memoryList, update: memoryUpdate, remove: memoryRemove },
    bots: { list: botsList, listArchived: vi.fn(async () => []) },
  },
}));
vi.mock("../lib/relative-time", () => ({ formatRelativeTime: () => "2d ago" }));
vi.mock("../lib/artifact-open", () => ({ downloadArtifactBytes: vi.fn() }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((result, part, index) => result + part + String(values[index] ?? ""), "");
  return {
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({ variant: _variant, ...props }: ComponentProps<"button"> & { variant?: string }) => (
      <button {...props} />
    ),
    Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
    Skeleton: Container,
  };
});
vi.mock("../components/ListControls", () => ({
  SearchField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
  PickFilter: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value?: string;
    options: [string, string][];
    onChange: (value: string | undefined) => void;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">All</option>
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  ),
}));

import { resetHideAmountsMemory, setHideAmounts } from "../lib/hide-amounts-preference";
import { KnowledgeSection, SpaceMemorySection } from "./KnowledgeSection";

it("previews what a memory document says instead of its file name", async () => {
  const { memoryDocPreview } = await import("./KnowledgeSection");
  expect(
    memoryDocPreview("# Memory\n\n- Board meeting is on the 28th\n- Prefers short replies"),
  ).toBe("Board meeting is on the 28th");
  expect(memoryDocPreview("1. Runway is 8.9 months")).toBe("Runway is 8.9 months");
  expect(memoryDocPreview("  \n#\n")).toBeNull();
});

it("masks currency in memory previews while amounts are hidden", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  memoryList.mockResolvedValueOnce([
    { id: "m1", path: "MEMORY.md", scope: "bot", content: "ARR is $2.4M" },
  ] as never);
  setHideAmounts(true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<KnowledgeSection botId="bot-fixture" />));
    expect(container.textContent).not.toContain("$2.4M");
    expect(container.textContent).toContain("ARR is");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    setHideAmounts(false);
    resetHideAmountsMemory();
    vi.unstubAllGlobals();
  }
});

it("drops file paths from memory previews", async () => {
  const { memoryDocPreview } = await import("./KnowledgeSection");
  expect(memoryDocPreview("- Q3 deck saved ([MOCK Q3 Deck](/app/artifacts/a1))")).toBe(
    "Q3 deck saved (MOCK Q3 Deck)",
  );
  expect(memoryDocPreview("- Report at (/app/artifacts/a1/report.md)")).toBe("Report at");
});

it("shows one empty message, not an empty row beside real memories", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const render = async (docs: unknown[]) => {
    memoryList.mockResolvedValueOnce(docs as never);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<KnowledgeSection botId="bot-fixture" />));
    return {
      text: container.textContent ?? "",
      hidden: container.querySelector("section")?.classList.contains("hidden"),
      done: () => root.unmount(),
    };
  };
  const mixed = await render([
    { id: "m1", path: "MEMORY.md", scope: "bot", content: "" },
    {
      id: "m2",
      path: "a.md",
      scope: "bot",
      content: "- Prefers short replies",
    },
  ]);
  expect(mixed.text).toContain("Prefers short replies");
  expect(mixed.text).not.toContain("Nothing remembered yet");
  const empty = await render([{ id: "m1", path: "MEMORY.md", scope: "bot", content: "" }]);
  // A bot with nothing remembered shows no Memory heading or empty line in its settings.
  expect(empty.text).not.toContain("Nothing remembered yet");
  expect(empty.hidden).toBe(true);
  expect(mixed.hidden).toBe(false);
  vi.unstubAllGlobals();
});

it("keeps the section visible when the memory list fails to load", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  memoryList.mockRejectedValueOnce(new Error("boom"));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<KnowledgeSection botId="bot-fixture" />));
    const section = container.querySelector('[data-testid="bot-knowledge"]');
    expect(section?.className).not.toContain("hidden");
    expect(container.textContent).toContain("Could not load");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("shows memory time and source and filters by agent", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  memoryList.mockReset().mockResolvedValueOnce([
    {
      id: "m1",
      path: "MEMORY.md",
      scope: "bot",
      botId: "bot-a",
      content: "Customer feedback check",
      updatedAt: "2026-11-07T00:00:00Z",
      source: { kind: "routine", label: "Customer feedback check" },
    },
    {
      id: "m2",
      path: "OTHER.md",
      scope: "bot",
      botId: "bot-b",
      content: "Another note",
      updatedAt: "2026-11-06T00:00:00Z",
      source: null,
    },
  ] as never);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <SpaceMemorySection />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("2d ago");
    expect(container.textContent).toContain("From Customer feedback check");
    const agentFilter = container.querySelector<HTMLSelectElement>('select[aria-label="Agent"]');
    expect(agentFilter).not.toBeNull();
    await act(async () => {
      agentFilter!.value = "bot-a";
      agentFilter!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("Customer feedback check");
    expect(container.textContent).not.toContain("Another note");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("retries a failed memory list load", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  memoryList
    .mockReset()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([
      {
        id: "m1",
        path: "MEMORY.md",
        scope: "bot",
        botId: "bot-a",
        content: "Customer feedback check",
        revision: 1,
      },
    ] as never);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <SpaceMemorySection />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("Could not load");
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).toBeDefined();
    await act(async () => retry!.click());
    expect(container.textContent).toContain("Customer feedback check");
    // A successful retry clears the failure.
    expect(container.textContent).not.toContain("Could not load");
    expect(
      [...container.querySelectorAll("button")].some((b) => b.textContent === "Try again"),
    ).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

async function openFirstMemory(docs: unknown[]) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  memoryList.mockResolvedValue(docs as never);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<KnowledgeSection botId="bot-fixture" />));
  const row = container.querySelector<HTMLButtonElement>(
    '[data-testid="bot-knowledge-memory"] button',
  )!;
  await act(async () => row.click());
  const button = (label: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
  return {
    container,
    button,
    done: async () => {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    },
  };
}

const doc = {
  id: "m1",
  path: "MEMORY.md",
  scope: "bot",
  botId: "bot-fixture",
  content: "- Likes tea",
  revision: 3,
  updatedAt: "2026-11-01T00:00:00.000Z",
};

it("deletes a memory after the Undo window and restores it on Undo without a server call", async () => {
  vi.useFakeTimers();
  memoryRemove.mockReset().mockResolvedValue({ ok: true });
  const ui = await openFirstMemory([doc]);
  try {
    await act(async () => ui.button("Delete").click());
    expect(ui.container.textContent).not.toContain("Likes tea");
    expect(ui.container.textContent).toContain("Memory deleted");
    await act(async () => ui.button("Undo").click());
    expect(ui.container.textContent).toContain("Likes tea");
    await act(async () => vi.advanceTimersByTime(6000));
    expect(memoryRemove).not.toHaveBeenCalled();

    await act(async () => ui.container.querySelector<HTMLButtonElement>("button")!.click());
    await act(async () => ui.button("Delete").click());
    await act(async () => vi.advanceTimersByTime(5000));
    expect(memoryRemove).toHaveBeenCalledWith({
      documentId: "m1",
      revision: 3,
    });
  } finally {
    await ui.done();
  }
});

it("sends a held delete at once when the list unmounts", async () => {
  vi.useFakeTimers();
  memoryRemove.mockReset().mockResolvedValue({ ok: true });
  const ui = await openFirstMemory([doc]);
  await act(async () => ui.button("Delete").click());
  await ui.done();
  expect(memoryRemove).toHaveBeenCalledWith({ documentId: "m1", revision: 3 });
});

it("reloads and says so when a held delete fails", async () => {
  vi.useFakeTimers();
  memoryRemove.mockReset().mockRejectedValue(new Error("boom"));
  const ui = await openFirstMemory([doc]);
  try {
    await act(async () => ui.button("Delete").click());
    await act(async () => vi.advanceTimersByTime(5000));
    expect(ui.container.textContent).toContain("Could not delete");
    expect(ui.container.textContent).toContain("Likes tea");
  } finally {
    await ui.done();
  }
});

it("says the memory changed when a held delete hits a newer revision", async () => {
  vi.useFakeTimers();
  memoryRemove.mockReset().mockRejectedValue({ code: "CONFLICT" });
  const ui = await openFirstMemory([doc]);
  try {
    await act(async () => ui.button("Delete").click());
    await act(async () => vi.advanceTimersByTime(5000));
    expect(ui.container.textContent).toContain("Changed since you opened it");
    expect(ui.container.textContent).not.toContain("Could not delete");
  } finally {
    await ui.done();
  }
});

it("does not allow saving a memory with nothing in it", async () => {
  memoryUpdate.mockReset().mockResolvedValue(doc as never);
  const ui = await openFirstMemory([doc]);
  try {
    const textarea = ui.container.querySelector("textarea")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    const type = (value: string) =>
      act(async () => {
        setValue.call(textarea, value);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await type("");
    expect(ui.button("Save").disabled).toBe(true);
    await type("# Heading");
    expect(ui.button("Save").disabled).toBe(true);
    await type("- x");
    expect(ui.button("Save").disabled).toBe(false);
    expect(memoryUpdate).not.toHaveBeenCalled();
  } finally {
    await ui.done();
  }
});

it("keeps the draft and says so when the memory changed since it was opened", async () => {
  memoryUpdate.mockReset().mockRejectedValue({ code: "CONFLICT" });
  const ui = await openFirstMemory([doc]);
  try {
    const textarea = ui.container.querySelector("textarea")!;
    expect(textarea.getAttribute("aria-label")).toBe("Memory");
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(textarea, "- Likes coffee");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => ui.button("Save").click());
    expect(memoryUpdate).toHaveBeenCalledWith({
      documentId: "m1",
      content: "- Likes coffee",
      expectedRevision: 3,
    });
    // Shown beside the open editor, not at the top of the list.
    const editor = ui.container.querySelector("textarea")!;
    expect(editor.parentElement!.querySelector('[role="alert"]')?.textContent).toBe(
      "Changed since you opened it",
    );
    expect(ui.container.querySelector("textarea")!.value).toBe("- Likes coffee");
  } finally {
    await ui.done();
  }
});

it("ignores the search of the page behind Settings", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  memoryList.mockResolvedValue([
    {
      id: "m1",
      scope: "user",
      botId: null,
      path: "prefs.md",
      content: "Prefers concise summaries.",
      revision: 1,
      updatedAt: "2026-11-06T00:00:00Z",
      source: null,
    },
  ] as never);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={["/app/contacts?q=zzz&agent=nobody"]}>
          <SpaceMemorySection />
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toContain("Prefers concise summaries.");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

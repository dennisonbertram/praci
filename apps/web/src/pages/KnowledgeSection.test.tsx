// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const memoryList = vi.hoisted(() => vi.fn(async () => []));
vi.mock("../lib/rpc", () => ({
  rpc: { memory: { list: memoryList } },
}));
vi.mock("../lib/artifact-open", () => ({ downloadArtifactBytes: vi.fn() }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray) => parts.join("");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
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

import { resetHideAmountsMemory, setHideAmounts } from "../lib/hide-amounts-preference";
import { KnowledgeSection } from "./KnowledgeSection";

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
    { id: "m2", path: "a.md", scope: "bot", content: "- Prefers short replies" },
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

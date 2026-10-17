// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { CommandPalette, paletteMatchScore } from "./command-palette";

const bot = (id: string, name: string) =>
  ({ id, name, title: "", description: "", preview: "", color: "#000", status: "idle" }) as Bot;

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount(onSelectPage = vi.fn()) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView ??= () => undefined;
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => {
    createRoot(container).render(
      <CommandPalette
        open
        onOpenChange={() => undefined}
        bots={[
          { ...bot("b1", "Chief"), description: "I find investor updates" },
          bot("b2", "Inbox agent"),
          bot("b3", "Finance agent"),
        ]}
        onSelectBot={() => undefined}
        pages={[{ id: "finance", label: "Finance" }]}
        groups={[{ id: "g1", label: "Leadership sync" }]}
        onSelectPage={onSelectPage}
      />,
    );
  });
}

async function search(value: string) {
  const input = document.querySelector<HTMLInputElement>("[data-testid=command-palette-search]");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("lists pages and groups, and keeps a bot's shortcut while filtering", async () => {
  await mount();
  expect(document.body.textContent).toContain("Leadership sync");
  const financeAgent = () =>
    document.querySelector("[data-testid=command-palette-bot-b3]")?.textContent ?? "";
  expect(financeAgent()).toContain("3");
  await search("finance");
  expect(document.body.textContent).toContain("Pages");
  expect(financeAgent()).toContain("3");
  expect(document.querySelector("[data-testid=command-palette-bot-b1]")).toBeNull();
});

const headings = () =>
  [...document.querySelectorAll("[cmdk-group-heading]")].map((node) => node.textContent);

it("puts the section with the best name match first and drops a group with no matches", async () => {
  await mount();
  expect(headings()).toEqual(["Bots", "Groups", "Pages"]);
  await search("finance");
  expect(headings()).toEqual(["Pages", "Bots"]);
  await search("lead");
  expect(headings()).toEqual(["Groups"]);
});

it("opens the Finance page for fin and Enter, ahead of bots that only mention it", async () => {
  const onSelectPage = vi.fn();
  await mount(onSelectPage);
  await search("fin");
  const input = document.querySelector("[data-testid=command-palette-search]");
  await act(async () => {
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onSelectPage).toHaveBeenCalledWith("finance");
});

it("ranks a name prefix over a word, a substring and a description match", () => {
  const scores = [
    paletteMatchScore("Finance", "fin"),
    paletteMatchScore("Finance agent", "fin"),
    paletteMatchScore("My finance", "fin"),
    paletteMatchScore("Chief", "fin", "find investors"),
  ];
  expect([...scores].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(scores);
  expect(paletteMatchScore("Chief", "fin")).toBeNull();
});

it("hides bots that only mention the search once something matches by name", async () => {
  await mount();
  await search("fin");
  // Chief only mentions "find" in its description; Finance and Finance agent match by name.
  expect(document.querySelector("[data-testid=command-palette-bot-b1]")).toBeNull();
  expect(document.querySelector("[data-testid=command-palette-bot-b3]")).not.toBeNull();
  await search("investor");
  // With no name match, the description match is still offered.
  expect(document.querySelector("[data-testid=command-palette-bot-b1]")).not.toBeNull();
});

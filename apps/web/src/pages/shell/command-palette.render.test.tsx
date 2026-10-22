// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
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

import { CommandPalette, paletteMatchScore, plainSnippet } from "./command-palette";

const bot = (id: string, name: string) =>
  ({ id, name, title: "", description: "", preview: "", color: "#000", status: "idle" }) as Bot;

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount(
  onSelectPage = vi.fn(),
  searchLinks?: ComponentProps<typeof CommandPalette>["searchLinks"],
  actions?: ComponentProps<typeof CommandPalette>["actions"],
) {
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
        pages={[
          { id: "finance", label: "Finance" },
          { id: "legal", label: "Legal", keywords: "contracts, NDA, deadlines" },
        ]}
        groups={[{ id: "g1", label: "Leadership sync" }]}
        onSelectPage={onSelectPage}
        searchLinks={searchLinks}
        actions={actions}
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
  expect(headings()).toEqual(["Pages", "Bots", "Groups"]);
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

it("finds a bot by its name or role, not by words in its description", async () => {
  await mount();
  await search("fin");
  // Chief only mentions "find" in its description; Finance and Finance agent match by name.
  expect(document.querySelector("[data-testid=command-palette-bot-b1]")).toBeNull();
  expect(document.querySelector("[data-testid=command-palette-bot-b3]")).not.toBeNull();
  await search("investor");
  // "investor" appears only in Chief's description, so Chief is not offered.
  expect(document.querySelector("[data-testid=command-palette-bot-b1]")).toBeNull();
});

it("shows Pages above Bots before typing, and finds Legal by a keyword", async () => {
  await mount();
  const text = document.body.textContent ?? "";
  expect(text.indexOf("Pages")).toBeGreaterThanOrEqual(0);
  expect(text.indexOf("Pages")).toBeLessThan(text.indexOf("Bots"));
  await search("nda");
  expect(document.body.textContent).toContain("Legal");
});

it("underlines the typed text in a result", async () => {
  await mount();
  await search("fin");
  const marks = [...document.querySelectorAll("[data-testid=command-palette-list] mark")];
  expect(marks.length).toBeGreaterThan(0);
  expect(marks.every((mark) => mark.textContent?.toLowerCase() === "fin")).toBe(true);
});

it("shows the matched field under a contact and a date on a chat hit, with the match underlined", async () => {
  await mount(undefined, async () => [
    {
      heading: "Contacts",
      entries: [{ id: "/c", label: "Dana Counselor", detail: "Halcyon Legal LLP" }],
    },
    {
      heading: "Chats",
      entries: [
        { id: "/chat", label: "Leadership sync", detail: "Halcyon term sheet", date: "Oct 3" },
      ],
    },
  ]);
  await search("halcyon");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  const list = document.querySelector("[data-testid=command-palette-list]")?.textContent ?? "";
  expect(list).toContain("Dana Counselor");
  expect(list).toContain("Halcyon Legal LLP");
  expect(list).toContain("Oct 3");
  const marks = [...document.querySelectorAll("[data-testid=command-palette-list] mark")];
  expect(marks.filter((mark) => mark.textContent === "Halcyon")).toHaveLength(2);
});

const listText = () =>
  document.querySelector("[data-testid=command-palette-list]")?.textContent ?? "";
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

it("does not say No results while the search is still running", async () => {
  await mount(undefined, () => new Promise(() => undefined));
  await search("zzzz");
  await wait(300);
  expect(listText()).not.toContain("No results");
});

it("says No results once the search has answered with nothing", async () => {
  await mount(undefined, async () => []);
  await search("zzzz");
  await wait(300);
  expect(listText()).toContain("No results");
});

it("lists direct matches before the mail search, marks rows with the group icon, and Enter opens the best match", async () => {
  const onSelectPage = vi.fn();
  await mount(onSelectPage, async () => [
    {
      heading: "Mail",
      fallback: true,
      icon: <svg data-testid="mail-icon" />,
      entries: [{ id: "/m", label: "Search mail for “fin”" }],
    },
    {
      heading: "Contacts",
      icon: <svg data-testid="contact-icon" />,
      entries: [{ id: "/c", label: "Fin Person", detail: "fin" }],
    },
  ]);
  await search("fin");
  await wait(300);
  const headings = [...document.querySelectorAll("[cmdk-group-heading]")].map((h) => h.textContent);
  expect(headings.at(-1)).toBe("Mail");
  expect(document.querySelector("[data-testid=mail-icon]")).toBeTruthy();
  expect(document.querySelector("[data-testid=contact-icon]")).toBeTruthy();
  // A snippet that only repeats the query is left out.
  expect(listText()).not.toMatch(/Fin Person\s*fin$/);
  const input = document.querySelector("[data-testid=command-palette-search]");
  await act(async () => {
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onSelectPage).toHaveBeenCalledWith("finance");
});

it("says nothing matched in pages, documents and contacts, and keeps the mail search", async () => {
  const onOpenPath = vi.fn();
  await mount(undefined, async () => [
    { heading: "Mail", fallback: true, entries: [{ id: "/m", label: "Search mail for “zzzqq”" }] },
  ]);
  await search("zzzqq");
  await wait(300);
  expect(listText()).toContain("No matches");
  expect(listText()).toContain("Search mail for “zzzqq”");
  expect(document.querySelector("[cmdk-item][data-selected=true]")?.textContent).toContain(
    "Search mail for",
  );
  expect(onOpenPath).not.toHaveBeenCalled();
});

it("returns focus to the element that opened it when it closes", async () => {
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
  const root = createRoot(container);
  const view = (open: boolean) => (
    <>
      <button type="button" data-testid="opener">
        Search
      </button>
      <CommandPalette open={open} onOpenChange={() => undefined} bots={[]} onSelectBot={() => {}} />
    </>
  );
  await act(async () => root.render(view(false)));
  const opener = document.querySelector<HTMLButtonElement>("[data-testid=opener]")!;
  opener.focus();
  await act(async () => root.render(view(true)));
  await wait(50);
  expect(document.activeElement).not.toBe(opener);
  await act(async () => root.render(view(false)));
  await wait(300);
  expect(document.activeElement).toBe(opener);
});

it("Enter opens a contact named exactly as typed, not the mail search, and a long title keeps the match in view", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await mount(vi.fn(), async () => [
    {
      heading: "Mail",
      fallback: true,
      entries: [{ id: "/m", label: "Search mail for “zed quill”" }],
    },
    {
      heading: "Contacts",
      entries: [{ id: "/c", label: "Zed Quill" }],
    },
    {
      heading: "Documents",
      entries: [
        { id: "/d", label: "Board materials for the annual general meeting with Zed Quill" },
      ],
    },
  ]);
  await search("zed quill");
  await wait(300);
  expect(listText()).toContain("…");
  expect(document.querySelector("[cmdk-item][data-selected=true]")?.textContent).toBe("Zed Quill");
});

it("strips markdown from a chat snippet", () => {
  expect(plainSnippet("**Halcyon** closes `Friday`")).toBe("Halcyon closes Friday");
});

it("keeps a row selected for Enter on open and after the search is cleared", async () => {
  const onSelectPage = vi.fn();
  await mount(onSelectPage);
  const enter = () =>
    act(async () => {
      document
        .querySelector("[data-testid=command-palette-search]")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  expect(document.querySelector("[cmdk-item][data-selected=true]")).not.toBeNull();
  await enter();
  expect(onSelectPage).toHaveBeenLastCalledWith("finance");
  await search("fin");
  await search("");
  expect(document.querySelector("[cmdk-item][data-selected=true]")).not.toBeNull();
  onSelectPage.mockClear();
  await enter();
  expect(onSelectPage).toHaveBeenCalledWith("finance");
});

it("offers an action only once the query matches it, and runs it", async () => {
  const run = vi.fn();
  await mount(vi.fn(), undefined, [{ label: "Group chats into folders", run }]);
  expect(document.body.textContent).not.toContain("Group chats into folders");
  await search("folders");
  const item = [...document.querySelectorAll("[cmdk-item]")].find((node) =>
    node.textContent?.includes("Group chats into folders"),
  );
  await act(async () => {
    item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(run).toHaveBeenCalledOnce();
});

it("offers New folder as an action too", async () => {
  const run = vi.fn();
  await mount(vi.fn(), undefined, [{ label: "New folder", run }]);
  await search("new fol");
  const item = [...document.querySelectorAll("[cmdk-item]")].find((node) =>
    node.textContent?.includes("New folder"),
  );
  await act(async () => {
    item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(run).toHaveBeenCalledOnce();
});

it("shows only the link text of a markdown link in a snippet", () => {
  expect(plainSnippet("a reply. [Open Settings](/app?settings=privacy) **now**")).toBe(
    "a reply. Open Settings now",
  );
});

it("masks dollar amounts in result details while Hide amounts is on, and shows them again off", async () => {
  const { setHideAmounts } = await import("../../lib/hide-amounts-preference");
  const searchLinks = async () => [
    {
      heading: "Chats",
      entries: [{ id: "/c", label: "Chief", detail: "runway is $1,620,000 at current burn" }],
    },
  ];
  await mount(vi.fn(), searchLinks);
  await search("runway");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(listText()).toContain("$1,620,000");
  await act(async () => setHideAmounts(true));
  expect(listText()).not.toContain("1,620,000");
  await act(async () => setHideAmounts(false));
  expect(listText()).toContain("$1,620,000");
});

it("lists an exact title match ahead of body-only hits and passes the query as typed", async () => {
  const seen: string[] = [];
  const searchLinks = async (q: string) => {
    seen.push(q);
    return [
      {
        heading: "Documents",
        entries: [
          { id: "/d1", label: "Monthly Update", detail: "mentions hiring plan" },
          { id: "/d2", label: "Board Update", detail: "mentions hiring plan" },
        ],
      },
      { heading: "Artifacts", entries: [{ id: "/a1", label: "Hiring Plan - Q4" }] },
    ];
  };
  await mount(vi.fn(), searchLinks);
  await search("Hiring Plan");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(seen).toEqual(["Hiring Plan"]);
  expect(headings()).toEqual(["Artifacts", "Documents"]);
  expect(document.body.textContent).toContain("Esc");
});

it("puts a group with an exact title ahead of a group with a partial title match", async () => {
  const searchLinks = async () => [
    {
      heading: "Documents",
      entries: [
        { id: "/d1", label: "Hiring Plan notes" },
        { id: "/d2", label: "Board Update", detail: "mentions hiring plan" },
      ],
    },
    { heading: "Artifacts", entries: [{ id: "/a1", label: "Hiring Plan" }] },
  ];
  await mount(vi.fn(), searchLinks);
  await search("Hiring Plan");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(headings()).toEqual(["Artifacts", "Documents"]);
});

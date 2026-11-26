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

import type { PaletteLinkGroup } from "./command-palette";
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
  searchOnlyBots?: Bot[],
  bots: Bot[] = [
    { ...bot("b1", "Chief"), description: "I find investor updates" },
    bot("b2", "Inbox agent"),
    bot("b3", "Finance agent"),
  ],
  overrides: Partial<ComponentProps<typeof CommandPalette>> = {},
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
        bots={bots}
        searchOnlyBots={searchOnlyBots}
        onSelectBot={() => undefined}
        pages={[
          { id: "finance", label: "Finance" },
          { id: "legal", label: "Legal", keywords: "contracts, NDA, deadlines" },
        ]}
        groups={[{ id: "g1", label: "Leadership sync" }]}
        onSelectPage={onSelectPage}
        searchLinks={searchLinks}
        actions={actions}
        {...overrides}
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

it("marks the typed text in a result with the same tint as Data room search", async () => {
  await mount();
  await search("fin");
  const marks = [...document.querySelectorAll("[data-testid=command-palette-list] mark")];
  expect(marks.length).toBeGreaterThan(0);
  expect(marks.every((mark) => mark.className.includes("bg-warning/25"))).toBe(true);
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

it("shows a search failure instead of No results", async () => {
  await mount(undefined, async () => {
    throw new Error("search failed");
  });
  await search("report");
  await wait(300);
  expect(listText()).toContain("Could not search");
  expect(listText()).not.toContain("No results");
});

it("keeps the other results and mail search when one search fails", async () => {
  await mount(undefined, async () => [
    { heading: "Chats", entries: [], failed: true },
    {
      heading: "Mail",
      fallback: true,
      entries: [{ id: "/app/inbox?q=report", label: "Search mail" }],
    },
  ]);
  await search("report");
  await wait(300);
  expect(listText()).toContain("Could not search");
  expect(listText()).toContain("Search mail");
  expect(listText()).not.toContain("No results");
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

it("shows only the mail search, with no contradicting no-match line, when nothing else matched", async () => {
  const onOpenPath = vi.fn();
  await mount(undefined, async () => [
    { heading: "Mail", fallback: true, entries: [{ id: "/m", label: "Search mail for “zzzqq”" }] },
  ]);
  await search("zzzqq");
  await wait(300);
  expect(listText()).not.toContain("No matches");
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

it("Enter opens a contact named exactly as typed, not the mail search, and a long title keeps its start", async () => {
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
  expect(listText()).toContain("Board materials for the annual");
  expect(listText()).not.toContain("…");
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

it("offers New bot beside a bot already named New Bot", async () => {
  const run = vi.fn();
  await mount(vi.fn(), undefined, [{ label: "New bot", run }], undefined, [bot("b1", "New Bot")]);
  await search("new bot");
  const item = (label: string) =>
    [...document.querySelectorAll("[cmdk-item]")].find((node) => node.textContent?.includes(label));
  expect(item("New Bot")).toBeDefined();
  const action = item("New bot");
  expect(action).toBeDefined();
  await act(async () => {
    action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

it("hides a chat only when its bot is shown under Bots", async () => {
  await mount(undefined, async () => [
    {
      heading: "Chats",
      entries: [
        { id: "/app/b3", label: "Finance agent chat" },
        { id: "/app/b1", label: "Chief chat" },
      ],
    },
  ]);
  // Finance agent matches by name; Chief matches only by words in its description.
  await search("fin");
  await wait(300);
  expect(listText()).not.toContain("Finance agent chat");
  expect(listText()).toContain("Chief chat");
});

it("ends a group that has more results with a row that opens them", async () => {
  await mount(vi.fn(), async () => [
    {
      heading: "Documents",
      entries: [{ id: "/d1", label: "Hiring Plan" }],
      more: { id: "/app/data-room?q=hiring", label: "See all in Data room" },
    },
  ]);
  await search("hiring");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(listText()).toContain("See all in Data room");
});

it("lists a search-only agent only once something is typed", async () => {
  await mount(vi.fn(), undefined, undefined, [bot("b9", "Legal agent")]);
  expect(document.querySelector("[data-testid=command-palette-bot-b9]")).toBeNull();
  await search("legal");
  expect(document.querySelector("[data-testid=command-palette-bot-b9]")).not.toBeNull();
  // It has no number: the shortcuts follow the listed bots.
  expect(document.querySelector("[data-testid=command-palette-bot-b9] kbd")).toBeNull();
});

const wait300 = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
const pressEnter = () =>
  act(async () => {
    document
      .querySelector("[data-testid=command-palette-search]")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });

it("ranks an action matched by keyword above body-only chat hits, and Enter runs it", async () => {
  const run = vi.fn();
  await mount(
    vi.fn(),
    async () => [
      {
        heading: "Chats",
        entries: [{ id: "/app/b1?m=x", label: "Data room agent", detail: "models we tried" }],
      },
    ],
    [{ label: "Model settings", keywords: "models", run }],
  );
  await search("models");
  await wait300();
  const rows = [...document.querySelectorAll("[cmdk-item]")].map((n) => n.textContent ?? "");
  expect(rows.findIndex((r) => r.includes("Model settings"))).toBeLessThan(
    rows.findIndex((r) => r.includes("Data room agent")),
  );
  await pressEnter();
  expect(run).toHaveBeenCalledOnce();
});

it("keeps a title-matching contact above an action and opens it on Enter", async () => {
  const run = vi.fn();
  await mount(
    vi.fn(),
    async () => [{ heading: "Contacts", entries: [{ id: "/c/1", label: "Models Inc" }] }],
    [{ label: "Model settings", keywords: "models", run }],
  );
  await search("models");
  await wait300();
  const rows = [...document.querySelectorAll("[cmdk-item]")].map((n) => n.textContent ?? "");
  const contactAt = rows.findIndex((r) => r.includes("Models Inc"));
  expect(contactAt).toBeGreaterThanOrEqual(0);
  expect(rows.findIndex((r) => r.includes("Model settings"))).toBeGreaterThan(contactAt);
  await pressEnter();
  expect(run).not.toHaveBeenCalled();
});

const selectedRow = () =>
  document.querySelector("[cmdk-item][data-selected=true]")?.textContent ?? "";
const pressArrowDown = () =>
  act(async () => {
    document
      .querySelector("[data-testid=command-palette-search]")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });

it("Enter while a newer search is pending does not open the previous query's result", async () => {
  const onOpenPath = vi.fn();
  const searchLinks = (q: string): Promise<PaletteLinkGroup[]> =>
    q === "fi"
      ? Promise.resolve([{ heading: "Contacts", entries: [{ id: "/c/fin", label: "Fin" }] }])
      : new Promise(() => undefined);
  await mount(vi.fn(), searchLinks, undefined, undefined, [], {
    pages: [],
    onOpenPath,
  });
  await search("fi");
  await wait300();
  expect(listText()).toContain("Fin");
  // The newer search is still running: the old rows stay but nothing is highlighted.
  await search("fin");
  await wait300();
  expect(listText()).toContain("Fin");
  expect(selectedRow()).toBe("");
  await pressEnter();
  expect(onOpenPath).not.toHaveBeenCalled();
});

it("never lets the arrow keys land on the hidden pending row", async () => {
  const searchLinks = (q: string): Promise<PaletteLinkGroup[]> =>
    q === "fi"
      ? Promise.resolve([{ heading: "Contacts", entries: [{ id: "/c/fin", label: "Fin" }] }])
      : new Promise(() => undefined);
  await mount(vi.fn(), searchLinks, undefined, undefined, [], { pages: [] });
  await search("fi");
  await wait300();
  await search("fin");
  await wait300();
  await pressArrowDown();
  expect(selectedRow()).toContain("Fin");
  await act(async () => {
    document
      .querySelector("[data-testid=command-palette-search]")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
      );
  });
  expect(selectedRow()).toContain("Fin");
});

it("keeps an arrowed-to row selected when late results for the same query arrive", async () => {
  let answer: (groups: PaletteLinkGroup[]) => void = () => undefined;
  const searchLinks = (q: string) =>
    q === "fi"
      ? Promise.resolve([
          { heading: "Contacts", entries: [{ id: "/c/fin-person", label: "Fin Person" }] },
        ])
      : new Promise<PaletteLinkGroup[]>((resolve) => {
          answer = resolve;
        });
  await mount(vi.fn(), searchLinks);
  await search("fi");
  await wait300();
  // Type on to a query whose results are still running, and arrow down to the old last row.
  await search("fin");
  await wait300();
  await pressArrowDown();
  await pressArrowDown();
  expect(selectedRow()).toContain("Fin Person");
  await act(async () => {
    answer([
      {
        heading: "Contacts",
        entries: [
          { id: "/c/fin", label: "Fin" },
          { id: "/c/fin-person", label: "Fin Person" },
        ],
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await wait(50);
  expect(selectedRow()).toContain("Fin Person");
});

it("does not search links for a single character", async () => {
  const searchLinks = vi.fn(async () => []);
  await mount(undefined, searchLinks);
  await search("f");
  await wait300();
  expect(searchLinks).not.toHaveBeenCalled();
  const list = document.querySelector("[data-testid=command-palette-list]");
  expect(list?.getAttribute("aria-busy")).toBe("false");
  expect(listText()).not.toContain("Searching");
});

// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import { inboxAgentSpawnKey, mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { AgentToggleList } from "./parts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= () =>
  ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }) as unknown as MediaQueryList;

const bot = (id: string, name: string, spawnKey: string | null = null) =>
  ({ id, name, color: "#000", spawnKey }) as unknown as Bot;

/** Ten ordinary agents a..j; only the ones in `start` begin on. */
const names = ["Ada", "Bea", "Cy", "Di", "Eve", "Fay", "Gus", "Hal", "Ivy", "Jo"];
const many = names.map((name) => bot(name.toLowerCase(), name));

function mount(props: {
  bots: Bot[];
  start: string[];
  owner?: string;
  onSetAll?: (on: boolean) => void;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const toggles: [string, boolean][] = [];
  function Host() {
    const [on, setOn] = useState(new Set(props.start));
    return (
      <AgentToggleList
        bots={props.bots}
        appName="Mercury"
        isOn={(id) => on.has(id)}
        onToggle={(id, next) => {
          toggles.push([id, next]);
          setOn((prev) => {
            const copy = new Set(prev);
            if (next) copy.add(id);
            else copy.delete(id);
            return copy;
          });
        }}
        onSetAll={props.onSetAll ?? (() => undefined)}
        ownerBotId={props.owner}
      />
    );
  }
  act(() => createRoot(container).render(<Host />));
  const order = () =>
    [...container.querySelectorAll('[role="switch"]')]
      .map((el) => el.getAttribute("aria-label")?.replace(" can use Mercury", ""))
      .filter((label) => label !== undefined);
  const search = (text: string) => {
    const input = container.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error("no search box");
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      set?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const flip = (name: string) =>
    act(() =>
      container.querySelector<HTMLElement>(`[aria-label="${name} can use Mercury"]`)?.click(),
    );
  const pick = async (label: string) => {
    const trigger = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Show"),
    );
    await act(async () => trigger?.click());
    const item = [...document.querySelectorAll('[role^="menuitem"]')].find(
      (el) => el.textContent === label,
    ) as HTMLElement | undefined;
    await act(async () => item?.click());
  };
  return { container, order, search, flip, pick, toggles };
}

it("shows no search or filter for 8 agents or fewer", () => {
  const view = mount({ bots: many.slice(0, 8), start: [] });
  expect(view.container.querySelector('input[type="search"]')).toBeNull();
  expect(view.container.textContent).not.toContain("All agents");
});

it("shows search and filter above 8 agents, on agents first then by name", () => {
  const view = mount({ bots: [...many].reverse(), start: ["jo", "cy"] });
  expect(view.container.querySelector('input[type="search"]')).not.toBeNull();
  expect(view.order().slice(0, 4)).toEqual(["Cy", "Jo", "Ada", "Bea"]);
});

it("search narrows rows by agent name", () => {
  const view = mount({ bots: many, start: [] });
  view.search("e");
  expect(view.order()).toEqual(["Bea", "Eve"]);
  view.search("zzz");
  expect(view.order()).toEqual([]);
  expect(view.container.textContent).toContain("No matching agents");
});

it("the On and Off filters keep only those agents", async () => {
  const view = mount({ bots: many, start: ["ada", "eve"] });
  await view.pick("On");
  expect(view.order()).toEqual(["Ada", "Eve"]);
  await view.pick("Off");
  expect(view.order()).toHaveLength(8);
  expect(view.order()).not.toContain("Ada");
});

it("a row does not move or vanish while its switch is flipped", async () => {
  const view = mount({ bots: many, start: ["ada", "eve"] });
  const before = view.order();
  view.flip("Jo");
  expect(view.order()).toEqual(before);
  await view.pick("On");
  expect(view.order()).toEqual(["Ada", "Eve", "Jo"]);
  view.flip("Ada"); // turning it off must not drop it from the On view
  expect(view.order()).toEqual(["Ada", "Eve", "Jo"]);
  view.search("e"); // re-filtered only when search or filter changes: Ada is off now
  expect(view.order()).toEqual(["Eve"]);
  expect(view.toggles).toEqual([
    ["jo", true],
    ["ada", false],
  ]);
});

it("All and None act on every other agent even when search hides most rows", () => {
  const onSetAll = vi.fn();
  const view = mount({ bots: many, start: ["ada"], onSetAll });
  view.search("zzz");
  const button = (name: string) =>
    [...view.container.querySelectorAll("button")].find((b) => b.textContent === name);
  expect(button("None")?.disabled).toBe(false); // ada is on although the view shows nobody
  act(() => button("None")?.click());
  act(() => button("All")?.click());
  expect(onSetAll.mock.calls).toEqual([[false], [true]]);
});

it("None stays disabled while only hidden agents are off, never because of the view", () => {
  const view = mount({ bots: many, start: [] });
  view.search("e");
  const none = [...view.container.querySelectorAll("button")].find((b) => b.textContent === "None");
  expect(none?.disabled).toBe(true);
});

it("keeps the Inbox agent and Email chats at the top whatever the search says", () => {
  const bots = [
    ...many,
    bot("inbox", "Inbox agent", inboxAgentSpawnKey("u1")),
    bot("chat", "Re: hi", mailThreadAgentSpawnKey("conn", "t1")),
  ];
  const view = mount({ bots, start: ["inbox", "chat"], owner: "inbox" });
  view.search("zzz");
  expect(view.order()).toEqual(["Inbox agent", "Email chats"]);
  view.search("");
  expect(view.order().slice(0, 3)).toEqual(["Inbox agent", "Email chats", "Ada"]);
});

function mountWrites(props: {
  start: string[];
  writing?: string[];
  enabled?: boolean;
  bots?: Bot[];
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const calls: [string, boolean][] = [];
  const bots = props.bots ?? [bot("owner", "Owner"), bot("ada", "Ada"), bot("bea", "Bea")];
  act(() =>
    createRoot(container).render(
      <AgentToggleList
        bots={bots}
        appName="Mercury"
        ownerBotId="owner"
        isOn={(id) => props.start.includes(id)}
        onToggle={() => undefined}
        writes={{
          enabled: props.enabled ?? true,
          isWriting: (id) => (props.writing ?? []).includes(id),
          onToggle: (id, next) => calls.push([id, next]),
        }}
      />,
    ),
  );
  const sw = (label: string) =>
    container.querySelector<HTMLElement>(`[aria-label="${label}"]`) as HTMLElement;
  return { container, calls, sw };
}

const isDisabled = (el: HTMLElement) =>
  el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";

it("shows Allow changes only under agents that are on, off by default", () => {
  const view = mountWrites({ start: ["owner", "ada"] });
  expect(view.sw("Ada can make changes in Mercury").getAttribute("aria-checked")).toBe("false");
  expect(view.sw("Bea can make changes in Mercury")).toBeNull();
  expect(view.container.textContent).toContain("The agent asks you before each change.");
});

it("flipping Allow changes calls onToggle for that agent only", () => {
  const view = mountWrites({ start: ["owner", "ada"] });
  act(() => view.sw("Ada can make changes in Mercury").click());
  expect(view.calls).toEqual([["ada", true]]);
});

it("the connection's own changes switch gates every nested switch", () => {
  const view = mountWrites({ start: ["owner", "ada"], writing: ["ada"], enabled: false });
  expect(isDisabled(view.sw("Ada can make changes in Mercury"))).toBe(true);
});

it("the owning agent shows the connection's switch and cannot be edited here", () => {
  const view = mountWrites({ start: ["owner"], enabled: true });
  const owner = view.sw("Owner can make changes in Mercury");
  expect(owner.getAttribute("aria-checked")).toBe("true");
  expect(isDisabled(owner)).toBe(true);
});

it("Email chats get no nested switch", () => {
  const chat = bot("chat", "Re: hi", mailThreadAgentSpawnKey("c", "t"));
  const view = mountWrites({
    start: ["owner", "chat"],
    bots: [bot("owner", "Inbox agent", inboxAgentSpawnKey("u1")), chat],
  });
  expect(
    view.container.querySelectorAll('[aria-label$="can make changes in Mercury"]'),
  ).toHaveLength(1);
});

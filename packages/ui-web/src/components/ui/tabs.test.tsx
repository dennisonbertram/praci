// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("triggers enumerate the transitioned properties instead of transition-all", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a" />
      </Tabs>,
    ),
  );
  const className = document.querySelector('[data-slot="tabs-trigger"]')?.className ?? "";
  expect(className).not.toContain("transition-all");
  // The focus-visible ring is box-shadow; it must keep animating.
  expect(className).toContain("box-shadow");
  await act(async () => root.unmount());
});

it("keeps overflowing tab lists reachable on fine-pointer windows", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Tabs defaultValue="overview">
        <TabsList>
          {[
            ["overview", "Overview"],
            ["people", "People"],
            ["organisations", "Organisations"],
            ["history", "History"],
            ["calendar", "Calendar"],
            ["review", "Review"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" />
      </Tabs>,
    ),
  );

  const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]');
  expect(list?.classList.contains("group-data-horizontal/tabs:overflow-x-auto")).toBe(true);
  expect(list?.classList.contains("group-data-horizontal/tabs:justify-start")).toBe(true);

  await act(async () => root.unmount());
  container.remove();
});

it("keeps vertical tab lists centered without horizontal overflow", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Tabs orientation="vertical" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" />
      </Tabs>,
    ),
  );

  const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]');
  const className = list?.className ?? "";
  expect(className).toContain("justify-center");
  // These assertions also reject the old pointer-coarse-only rules. Vertical
  // lists should not acquire horizontal scrolling or start alignment at any pointer type.
  expect(className).not.toContain("pointer-coarse:overflow-x-auto");
  expect(className).not.toContain("pointer-coarse:justify-start");
  expect(list?.getAttribute("aria-orientation")).toBe("vertical");

  await act(async () => root.unmount());
  container.remove();
});

it("moves focus, selection, and the horizontal viewport with the arrow keys", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Tabs defaultValue="overview">
        <TabsList activateOnFocus>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" />
        <TabsContent value="people" />
        <TabsContent value="history" />
      </Tabs>,
    ),
  );

  const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]')!;
  const [overview, people, history] = Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]'),
  );
  Object.defineProperties(list, {
    clientWidth: { configurable: true, value: 220 },
    scrollWidth: { configurable: true, value: 480 },
  });
  Object.defineProperties(people!, {
    offsetLeft: { configurable: true, value: 250 },
    offsetWidth: { configurable: true, value: 80 },
  });
  const scrollTo = vi.fn();
  list.scrollTo = scrollTo;

  await act(async () => {
    overview!.focus();
    overview!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
  });

  expect(document.activeElement).toBe(people);
  expect(people?.getAttribute("aria-selected")).toBe("true");
  expect(overview?.getAttribute("aria-selected")).toBe("false");
  expect(people?.className).toContain("focus-visible:ring");
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

  expect(people?.getAttribute("aria-selected")).toBe("true");
  expect(overview?.getAttribute("aria-selected")).toBe("false");
  expect(history?.getAttribute("aria-selected")).toBe("false");
  expect(scrollTo).toHaveBeenCalledWith({ left: 180 });

  await act(async () => {
    people!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
    );
  });

  expect(document.activeElement).toBe(overview);
  expect(overview?.getAttribute("aria-selected")).toBe("true");

  await act(async () => root.unmount());
  container.remove();
});

it("moves focus and selection with vertical arrow keys", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Tabs orientation="vertical" defaultValue="overview">
        <TabsList activateOnFocus>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" />
        <TabsContent value="activity" />
        <TabsContent value="settings" />
      </Tabs>,
    ),
  );

  const [overview, activity, settings] = Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]'),
  );

  await act(async () => {
    overview!.focus();
    overview!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
  });

  expect(document.activeElement).toBe(activity);
  expect(activity?.getAttribute("aria-selected")).toBe("true");
  expect(overview?.getAttribute("aria-selected")).toBe("false");
  expect(activity?.className).toContain("focus-visible:ring");
  expect(settings?.getAttribute("aria-selected")).toBe("false");

  await act(async () => {
    activity!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
    );
  });

  expect(document.activeElement).toBe(overview);
  expect(overview?.getAttribute("aria-selected")).toBe("true");

  await act(async () => root.unmount());
  container.remove();
});

it("scrolls newly active tabs into view", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">Overview</TabsTrigger>
          <TabsTrigger value="two">People</TabsTrigger>
          <TabsTrigger value="three">Organisations</TabsTrigger>
          <TabsTrigger value="four">History</TabsTrigger>
        </TabsList>
        <TabsContent value="one" />
      </Tabs>,
    ),
  );

  const list = container.querySelector<HTMLElement>('[data-slot="tabs-list"]')!;
  const firstTab = container.querySelector<HTMLElement>('[data-slot="tabs-trigger"]')!;
  const secondTab = container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]')[1]!;
  Object.defineProperties(list, {
    clientWidth: { configurable: true, value: 220 },
    scrollWidth: { configurable: true, value: 480 },
  });
  Object.defineProperties(secondTab, {
    offsetLeft: { configurable: true, value: 250 },
    offsetWidth: { configurable: true, value: 80 },
  });
  const scrollTo = vi.fn();
  list.scrollTo = scrollTo;

  await act(async () => {
    firstTab.removeAttribute("data-active");
    secondTab.setAttribute("data-active", "");
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

  expect(secondTab.hasAttribute("data-active")).toBe(true);
  expect(scrollTo).toHaveBeenCalledWith({ left: 180 });

  await act(async () => root.unmount());
  container.remove();
});

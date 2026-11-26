// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
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

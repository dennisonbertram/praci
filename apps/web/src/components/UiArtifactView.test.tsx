// @vitest-environment jsdom

import { createUiArtifact } from "@rakazo/ui-artifact";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { resetHideAmountsMemory, setHideAmounts } from "../lib/hide-amounts-preference";
import { UiArtifactView } from "./UiArtifactView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  resetHideAmountsMemory();
});

function render(source: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<UiArtifactView source={source} />));
  return host;
}

function sourceOf(blocks: unknown[]): string {
  const created = createUiArtifact({ title: "t", blocks });
  if (!created.ok) throw new Error(created.errors.join("; "));
  return created.source;
}

describe("UiArtifactView", () => {
  it("renders every block type", () => {
    const host = render(
      sourceOf([
        { type: "heading", text: "Head", level: 1 },
        { type: "text", text: "Body", muted: true },
        { type: "metric", label: "Users", value: "12", delta: "+2" },
        { type: "table", columns: ["A", "B"], rows: [["x", 1]] },
        { type: "list", items: ["one", "two"], ordered: true },
        { type: "badge", text: "Ok", tone: "success" },
        { type: "divider" },
        {
          type: "chart",
          kind: "line",
          labels: ["a", "b"],
          series: [{ name: "S", values: [1, 2] }],
        },
        {
          type: "card",
          title: "Card title",
          children: [{ type: "grid", columns: 2, children: [{ type: "text", text: "inner" }] }],
        },
        { type: "stack", children: [{ type: "text", text: "stacked" }] },
      ]),
    );
    expect(host.querySelector("h1")?.textContent).toBe("Head");
    for (const text of [
      "Body",
      "Users",
      "12",
      "+2",
      "x",
      "1",
      "Ok",
      "Card title",
      "inner",
      "stacked",
    ])
      expect(host.textContent).toContain(text);
    expect(host.querySelectorAll("table th")).toHaveLength(2);
    expect(host.querySelectorAll("ol li")).toHaveLength(2);
    expect(host.querySelector("svg polyline")).not.toBeNull();
    expect(host.querySelector("[data-testid=ui-artifact-unsupported]")).toBeNull();
  });

  it("draws bars for a bar chart", () => {
    const host = render(
      sourceOf([
        { type: "chart", kind: "bar", labels: ["a", "b"], series: [{ name: "S", values: [1, 2] }] },
      ]),
    );
    expect(host.querySelectorAll("svg rect")).toHaveLength(2);
  });

  it("shows markup as text and creates no elements, links or images from it", () => {
    const host = render(
      sourceOf([
        {
          type: "text",
          text: '<img src=x onerror="alert(1)"><a href="https://e.com">x</a> [l](https://e.com)',
        },
        { type: "list", items: ["<script>alert(1)</script>"] },
        { type: "table", columns: ["<b>c</b>"], rows: [["<i>d</i>"]] },
      ]),
    );
    expect(host.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(host.textContent).toContain("<script>alert(1)</script>");
    expect(host.querySelector("img, a, script, b, i, iframe")).toBeNull();
  });

  it("drops an unknown component and says so, without raw markup", () => {
    const host = render(
      'root = Stack([Heading("Kept"), Button("Go", @OpenUrl("https://e.com")), Image("https://e.com/a.png")])',
    );
    expect(host.textContent).toContain("Kept");
    expect(host.textContent).not.toContain("Button");
    expect(host.textContent).not.toContain("e.com");
    expect(host.querySelector("a, img, button")).toBeNull();
    expect(host.querySelector("[data-testid=ui-artifact-unsupported]")).not.toBeNull();
  });

  it("shows the placeholder for an empty or hostile source", () => {
    expect(render("").querySelector("[data-testid=ui-artifact-unsupported]")).not.toBeNull();
    const deep = `root = ${"Stack([".repeat(3000)}${"])".repeat(3000)}`;
    expect(render(deep).querySelector("[data-testid=ui-artifact-unsupported]")).not.toBeNull();
  });

  it("masks amounts while Hide money is on, and hides a money chart", () => {
    const source = sourceOf([
      { type: "metric", label: "Revenue", value: "$48,200", delta: "+4%" },
      { type: "table", columns: ["Item", "Qty"], rows: [["Seats", 12]] },
      {
        type: "chart",
        kind: "bar",
        labels: ["a"],
        series: [{ name: "S", values: [5] }],
        money: true,
      },
    ]);
    const host = render(source);
    expect(host.textContent).toContain("$48,200");
    expect(host.querySelector("svg")).not.toBeNull();
    act(() => setHideAmounts(true));
    expect(host.textContent).not.toContain("$48,200");
    expect(host.textContent).not.toContain("12");
    expect(host.textContent).toContain("Revenue");
    expect(host.querySelector("[data-testid=chart-hidden]")).not.toBeNull();
    expect(host.querySelector("svg")).toBeNull();
    act(() => setHideAmounts(false));
    expect(host.textContent).toContain("$48,200");
  });
});

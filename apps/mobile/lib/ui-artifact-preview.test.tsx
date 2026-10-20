// @vitest-environment jsdom

import { createUiArtifact } from "@rakazo/ui-artifact";
import type { ReactNode } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => {
  const box = (tag: string) => (props: { children?: ReactNode; accessibilityRole?: string }) =>
    createElement(tag, { "data-role": props.accessibilityRole }, props.children);
  return {
    View: box("div"),
    Text: box("span"),
    ScrollView: box("div"),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  };
});
vi.mock("react-native-svg", () => {
  const el = (tag: string) => (props: { children?: ReactNode }) =>
    createElement(tag, null, props.children);
  return {
    default: el("svg"),
    G: el("g"),
    Line: el("line"),
    Polyline: el("polyline"),
    Rect: el("rect"),
    Text: el("text"),
  };
});
vi.mock("./native", () => ({
  native: new Proxy({}, { get: () => "color" }),
  useThemedStyles: <T,>(factory: () => T) => factory(),
}));
vi.mock("./appearance", () => ({
  mobileTokens: () => new Proxy({}, { get: () => "#000000" }),
}));
vi.mock("./i18n", () => ({ useI18n: () => ({ t: (message: string) => message }) }));

import { UiArtifactPreview } from "../components/ui-artifact-preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  document.body.innerHTML = "";
});

function render(source: string) {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<UiArtifactPreview source={source} />));
  return host;
}

describe("UiArtifactPreview", () => {
  it("renders each block natively, with markup as plain text", () => {
    const created = createUiArtifact({
      title: "t",
      blocks: [
        { type: "heading", text: "Head" },
        { type: "metric", label: "Users", value: "12", delta: "+2" },
        { type: "table", columns: ["A"], rows: [["<b>x</b>"]] },
        { type: "list", items: ["one"], ordered: true },
        { type: "badge", text: "Ok" },
        { type: "divider" },
        { type: "chart", kind: "bar", labels: ["a"], series: [{ name: "S", values: [1] }] },
        { type: "card", title: "Card", children: [{ type: "text", text: "inner" }] },
        { type: "grid", children: [{ type: "text", text: "gridded" }] },
      ],
    });
    if (!created.ok) throw new Error(created.errors.join("; "));
    const host = render(created.source);
    for (const text of [
      "Head",
      "Users",
      "12",
      "+2",
      "<b>x</b>",
      "1.",
      "one",
      "Ok",
      "Card",
      "inner",
      "gridded",
    ])
      expect(host.textContent).toContain(text);
    expect(host.querySelector("b, a, img, script, iframe")).toBeNull();
    expect(host.textContent).not.toContain("can't be shown");
  });

  it("drops unknown components and notes it", () => {
    const host = render('root = Stack([Heading("Kept"), Image("https://e.com/a.png")])');
    expect(host.textContent).toContain("Kept");
    expect(host.textContent).not.toContain("e.com");
    expect(host.textContent).toContain("Part of this can't be shown.");
  });
});

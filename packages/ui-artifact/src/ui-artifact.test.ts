import { describe, expect, it } from "vitest";
import { createUiArtifact, parseUiArtifact, UI_LIMITS } from "./index.js";

const sample = {
  title: "Weekly summary",
  blocks: [
    { type: "heading", text: "Week 42", level: 1 },
    { type: "metric", label: "Revenue", value: "$12,400", delta: "+4.2%" },
    {
      type: "grid",
      columns: 2,
      children: [
        {
          type: "card",
          title: "Top items",
          children: [{ type: "list", items: ["a", "b"], ordered: true }],
        },
        { type: "badge", text: "On track", tone: "success" },
      ],
    },
    {
      type: "table",
      columns: ["Name", "Qty"],
      rows: [
        ["x", 1],
        ["y", null],
        ["z", -2.5e-7],
      ],
    },
    {
      type: "chart",
      kind: "line",
      labels: ["Mon", "Tue"],
      series: [{ name: "Sales", values: [1, -2.5] }],
    },
    { type: "divider" },
    { type: "text", text: "plain", muted: true },
  ],
};

describe("create_ui_artifact", () => {
  it("round-trips every block through OpenUI Lang", () => {
    const created = createUiArtifact(sample);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const parsed = parseUiArtifact(created.source);
    expect(parsed.problems).toEqual([]);
    expect(parsed.blocks).toEqual(sample.blocks);
  });

  it("returns clear errors for invalid arguments", () => {
    const bad = createUiArtifact({ title: "t", blocks: [{ type: "button", text: "x" }] });
    expect(bad.ok).toBe(false);
    const noBlocks = createUiArtifact({ title: "t", blocks: [] });
    expect(noBlocks.ok).toBe(false);
    const ragged = createUiArtifact({
      title: "t",
      blocks: [{ type: "table", columns: ["a"], rows: [["1", "2"]] }],
    });
    expect(ragged).toMatchObject({ ok: false });
  });
});

describe("limits", () => {
  const text = (n: number) => ({ type: "text", text: "x".repeat(n) });
  it("refuses oversized and over-deep input from the tool", () => {
    expect(createUiArtifact({ title: "t", blocks: [text(UI_LIMITS.textChars + 1)] }).ok).toBe(
      false,
    );
    const rows = Array.from({ length: UI_LIMITS.tableRows + 1 }, () => ["a"]);
    expect(
      createUiArtifact({ title: "t", blocks: [{ type: "table", columns: ["a"], rows }] }).ok,
    ).toBe(false);
    const blocks = Array.from({ length: UI_LIMITS.layoutChildren }, () => ({
      type: "stack",
      children: Array.from({ length: 6 }, () => text(1)),
    }));
    expect(createUiArtifact({ title: "t", blocks }).ok).toBe(false); // 280 blocks
    let nested: unknown = text(1);
    for (let i = 0; i < UI_LIMITS.depth + 1; i++) nested = { type: "stack", children: [nested] };
    const tooDeep = createUiArtifact({ title: "t", blocks: [nested] });
    expect(tooDeep).toMatchObject({ ok: false });
    let ok: unknown = text(1);
    for (let i = 0; i < UI_LIMITS.depth; i++) ok = { type: "stack", children: [ok] };
    expect(createUiArtifact({ title: "t", blocks: [ok] }).ok).toBe(true);
  });

  it("refuses a source that is too long or nested too deeply without throwing", () => {
    expect(parseUiArtifact("x".repeat(UI_LIMITS.sourceChars + 1)).blocks).toEqual([]);
    const deep = `root = ${"Stack([".repeat(5000)}${"])".repeat(5000)}`;
    const parsed = parseUiArtifact(deep);
    expect(parsed.blocks).toEqual([]);
    expect(parsed.problems.length).toBeGreaterThan(0);
    expect(() => parseUiArtifact("root = Stack([Text(")).not.toThrow();
    expect(() => parseUiArtifact('\u0000\ud800 ((( "')).not.toThrow();
  });

  it("caps the blocks of a stored source", () => {
    const many = `root = Stack([${Array.from({ length: UI_LIMITS.blocks + 50 }, () => "Divider()").join(", ")}])`;
    const parsed = parseUiArtifact(many);
    expect(parsed.blocks.length).toBeLessThanOrEqual(UI_LIMITS.blocks);
    expect(parsed.problems.length).toBeGreaterThan(0);
  });
});

describe("hostile content", () => {
  const markup =
    '<script>alert(1)</script> <img src=x onerror=alert(1)> [x](javascript:alert(1)) "); root = Stack([';
  it("keeps markup inside a string as that string", () => {
    const created = createUiArtifact({
      title: "t",
      blocks: [
        { type: "text", text: markup },
        { type: "list", items: [markup] },
      ],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(parseUiArtifact(created.source).blocks).toEqual([
      { type: "text", text: markup },
      { type: "list", items: [markup] },
    ]);
  });

  it("drops unknown components, actions, queries and state, and reports them", () => {
    const parsed = parseUiArtifact(
      [
        "$count = 0",
        'data = Query("list_files", {}, {})',
        'root = Stack([Heading("ok"), Button("go", @OpenUrl("https://example.com")), Image("https://x/y.png"), Text("a", true, "extra"), Divider()])',
      ].join("\n"),
    );
    expect(parsed.blocks.map((b) => b.type)).toEqual(["heading", "text", "divider"]);
    expect(parsed.problems.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed.blocks)).not.toContain("example.com");
  });
});

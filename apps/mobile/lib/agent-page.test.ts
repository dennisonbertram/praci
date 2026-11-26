import { describe, expect, it } from "vitest";
import { htmlPageDataScript, pageBlocks, sidebarBotPages } from "./agent-page";

const chart = (name: string) =>
  `\`\`\`chart\n${JSON.stringify({ name, spec: {}, data: [] })}\n\`\`\``;

describe("pageBlocks", () => {
  it("aligns SVGs with valid charts only and flags invalid or unmatched ones", () => {
    const content = ["# Hi", chart("a"), "```chart\nnot json\n```", chart("b"), chart("c")].join(
      "\n",
    );
    const blocks = pageBlocks(content, ["<svg a/>", "<svg b/>"]);
    expect(blocks.map((b) => b.kind)).toEqual([
      "markdown",
      "chart",
      "chart_error",
      "chart",
      "chart_error",
    ]);
    expect(blocks[1]).toMatchObject({ name: "a", svg: "<svg a/>" });
    expect(blocks[3]).toMatchObject({ name: "b", svg: "<svg b/>" });
  });

  it("skips valid and invalid GTM blocks without shifting chart SVGs", () => {
    const validGtm = '```gtm-plan\n{"group":"done"}\n```';
    const invalidGtm = "```gtm-unknown\n{}\n```";
    const blocks = pageBlocks([chart("a"), validGtm, invalidGtm, chart("b")].join("\n"), [
      "<svg a/>",
      "<svg b/>",
    ]);
    expect(blocks).toEqual([
      { kind: "chart", name: "a", svg: "<svg a/>" },
      { kind: "chart", name: "b", svg: "<svg b/>" },
    ]);
  });

  const metric = (label: string, format = "usd") =>
    `\`\`\`metric\n${JSON.stringify({ label, source: "cash", path: "/x", format })}\n\`\`\``;
  const table = `\`\`\`table\n${JSON.stringify({
    name: "Vendors",
    source: "spend",
    path: "/v",
    columns: [
      { key: "name", label: "Vendor" },
      { key: "total", label: "Total", format: "usd" },
    ],
  })}\n\`\`\``;
  const sourced = `\`\`\`chart\n${JSON.stringify({ name: "Live", spec: {}, data: [], source: "cash", path: "/c" })}\n\`\`\``;
  const ok = (extra: object) => ({ status: "ok" as const, fetchedAt: null, ...extra });

  it("pairs live data with metric, table and sourced chart segments in order, skipping static charts", () => {
    const content = [chart("static"), metric("Burn"), sourced, table].join("\n");
    const blocks = pageBlocks(
      content,
      ["<svg s/>", "<svg l/>"],
      [
        ok({ text: "$86K" }),
        ok({ rows: [{ chart: 1 }] }),
        ok({ rows: [{ name: "Acme", total: 1234.5 }] }),
      ],
    );
    expect(blocks.map((b) => b.kind)).toEqual(["chart", "metric", "chart", "table"]);
    expect(blocks[1]).toMatchObject({
      label: "Burn",
      status: "ok",
      value: { text: "$86K", usd: true },
    });
    expect(blocks[3]).toMatchObject({
      name: "Vendors",
      hasRows: true,
      rows: [
        {
          title: { text: "Acme", usd: false },
          details: [{ text: "Total: $1,235", usd: true }],
        },
      ],
    });
  });

  it("keeps the failed status with the last value, and placeholders when there is no data", () => {
    const blocks = pageBlocks(
      [metric("A"), metric("B"), table].join("\n"),
      [],
      [
        { status: "failed", fetchedAt: null, error: "timed out", text: "$1" },
        { status: "pending", fetchedAt: null },
      ],
    );
    expect(blocks[0]).toMatchObject({
      status: "failed",
      error: "timed out",
      value: { text: "$1" },
    });
    expect(blocks[1]).toMatchObject({ status: "pending", value: undefined });
    expect(blocks[2]).toMatchObject({ kind: "table", status: "empty", hasRows: false, rows: [] });
  });

  it("shows an invalid live fence as an error line without shifting live data", () => {
    const blocks = pageBlocks(
      ["```metric\nnot json\n```", metric("A")].join("\n"),
      [],
      [ok({ text: "5" })],
    );
    expect(blocks.map((b) => b.kind)).toEqual(["chart_error", "metric"]);
    expect(blocks[1]).toMatchObject({ value: { text: "5" } });
  });
});

describe("sidebarBotPages", () => {
  it("keeps only bot page rows", () => {
    const row = { pageId: "p1", botId: "b1", title: "Cash" };
    expect(
      sidebarBotPages({ pages: [{ templateKey: "team-health" }, row], addable: [], botPages: [] }),
    ).toEqual([row]);
  });
});

describe("htmlPageDataScript", () => {
  const run = (sources: unknown) => {
    const events: unknown[] = [];
    // Evaluate the script the way the WebView would, with a stub window.
    new Function("window", "MessageEvent", htmlPageDataScript(sources))(
      { dispatchEvent: (event: unknown) => events.push(event) },
      class {
        constructor(
          public type: string,
          public init: { data: unknown },
        ) {}
      },
    );
    return events as { type: string; init: { data: unknown } }[];
  };

  it("delivers the sources as a message event, round-tripping hostile strings", () => {
    const sources = {
      "a</script><script>alert(1)": {
        status: "ok",
        value: "x\"'`\\ ${1+1} \u2028 \u2029 </script>",
        __proto__: { polluted: true },
      },
    };
    const [event] = run(sources);
    expect(event?.type).toBe("message");
    expect(event?.init.data).toEqual({
      type: "praci-data",
      sources: JSON.parse(JSON.stringify(sources)),
    });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("contains no raw line separators and cannot close a script element", () => {
    const script = htmlPageDataScript({ A: { value: "\u2028\u2029</script>" } });
    expect(script).not.toMatch(/[\u2028\u2029]/);
    expect(script.split("\n")).toHaveLength(1);
    expect(script.endsWith("true;")).toBe(true);
  });
});

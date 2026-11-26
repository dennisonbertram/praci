import type { PageData } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { renderPageSnapshotHtml } from "./page-snapshot.js";

const fence = (lang: string, body: unknown) => `\`\`\`${lang}\n${JSON.stringify(body)}\n\`\`\``;
const SECRET_CALL = "SECRETCALL_list_invoices_7731";

const content = [
  "# Cash <script>alert(1)</script>",
  "Visit [site](https://example.com/a) and [bad](javascript:alert(1)) <img src=https://evil.test/x.png>",
  fence("metric", { label: "Runway", source: SECRET_CALL, path: "/months", format: "number" }),
  fence("table", {
    name: "Invoices",
    source: SECRET_CALL,
    columns: [
      { key: "who", label: "Who" },
      { key: "amt", label: "Amount", format: "usd" },
    ],
  }),
  fence("chart", {
    name: "Burn",
    spec: { marks: [{ type: "barY", options: { x: "m", y: "v" } }] },
    data: [{ m: "Jan", v: 3 }],
  }),
  fence("chart", {
    name: "Live",
    source: SECRET_CALL,
    path: "/rows",
    spec: { marks: [{ type: "barY", options: { x: "m", y: "v" } }] },
    data: [],
  }),
  fence("metric", { label: "Gone", source: "nope", path: "" }),
  fence("metric", { label: "Waiting", source: "p", path: "" }),
].join("\n\n");

const data: PageData = {
  pageId: "p1",
  revision: 1,
  blocks: [
    { status: "ok", fetchedAt: "2026-10-30T10:00:00Z", text: "14" },
    {
      status: "failed",
      fetchedAt: "2026-10-30T10:00:00Z",
      error: `call ${SECRET_CALL} to https://api.internal.test failed`,
      rows: [{ who: "Ada <b>", amt: 1234 }],
    },
    { status: "ok", fetchedAt: "2026-10-30T10:00:00Z", rows: [{ m: "Feb", v: 9 }] },
    { status: "missing", fetchedAt: null },
    { status: "pending", fetchedAt: null },
  ],
};

describe("renderPageSnapshotHtml", () => {
  it("renders a self-contained static document from rendered values only", async () => {
    const html = await renderPageSnapshotHtml(
      { title: "Cash & more", content },
      data,
      new Date("2026-10-30T12:34:00Z"),
    );
    expect(html).toContain("<h1>Cash &amp; more</h1>");
    expect(html).toContain("Snapshot 2026-10-30 12:34 UTC");
    expect(html).toContain('<p class="v">14</p>');
    expect(html).toContain("<td>$1,234</td>");
    expect(html).toContain("<td>Ada &lt;b&gt;</td>");
    expect(html).toContain("<svg");
    expect(html).toContain("Source not found");
    expect(html).toContain("Waiting for approval");
    // Page text is data, never markup.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('<a href="https://example.com/a"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("&lt;img");
    // Nothing about the sources, and nothing loaded from outside.
    for (const leak of [SECRET_CALL, "api.internal.test", "failed"])
      expect(html).not.toContain(leak);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("Chart could not be rendered");
    // The only URL is the link the page text itself contains (plus the one in its escaped text).
    expect(html.match(/https?:\/\/[^"'\s<]+/g)).toEqual([
      "https://example.com/a",
      "https://evil.test/x.png%3E",
      "https://evil.test/x.png&gt;",
    ]);
  });

  it("treats a missing kind as blocks and refuses an unknown kind", async () => {
    await expect(renderPageSnapshotHtml({ title: "T", content: "hi" }, data)).resolves.toContain(
      "<p>hi</p>",
    );
    await expect(
      renderPageSnapshotHtml({ title: "T", content: "hi", kind: "other" }, data),
    ).rejects.toThrow();
  });

  it("keeps an html page's markup and delivers its data as the praci-data event", async () => {
    const markup =
      '<!doctype html><html><head><title>Cash</title></head><body><div id="app">hi</div><script>window.addEventListener("message",function(e){})</script></body></html>';
    const html = await renderPageSnapshotHtml({ title: "Cash", content: markup, kind: "html" }, {
      kind: "html",
      pageId: "p1",
      revision: 1,
      sources: {
        cash: {
          status: "ok",
          fetchedAt: "2026-10-30T10:00:00Z",
          value: { note: "</script><b>x\u2028" },
        },
      },
    } as never);
    expect(html).toContain('<div id="app">hi</div>');
    expect(html).toContain(
      '<head><meta http-equiv="x-dns-prefetch-control" content="off"><script>',
    );
    expect(html).toContain("praci-data");
    // A value cannot close the script element or add markup.
    expect(html.match(/<\/script>/gi)).toHaveLength(2);
    expect(html).not.toContain("<b>x");
    expect(html).not.toContain("\u2028");
    // The script text, evaluated, delivers the original value.
    const script =
      /<script>window\.addEventListener\("load",function\(\)\{(.*?)\}\);<\/script>/s.exec(
        html,
      )![1]!;
    const events: unknown[] = [];
    new Function("window", "MessageEvent", script)(
      { dispatchEvent: (e: unknown) => events.push(e) },
      class {
        constructor(
          public type: string,
          public init: { data: unknown },
        ) {}
      },
    );
    expect((events[0] as { init: { data: unknown } }).init.data).toEqual({
      type: "praci-data",
      sources: {
        cash: {
          status: "ok",
          fetchedAt: "2026-10-30T10:00:00Z",
          value: { note: "</script><b>x\u2028" },
        },
      },
    });
    for (const leak of ["list_invoices", "api.internal.test", "http://", "https://"])
      expect(html).not.toContain(leak);
  });
});

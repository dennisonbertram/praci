import type { ArtifactStore } from "@rakazo/adapter-kit";
import { DATA_ROOM_AGENT_BUILTIN_TOOLS, LEGAL_AGENT_BUILTIN_TOOLS } from "@rakazo/contracts";
import { inferAttachmentMimeType, unattendedTriggerToolRequiresApproval } from "@rakazo/core";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { selectBuiltinToolsForRun } from "./executor.js";
import { buildXlsx, readSpreadsheet, spreadsheetKind } from "./spreadsheet.js";
import {
  createSpreadsheetBytes,
  readSpreadsheetTool,
  spreadsheetAttachmentSummary,
} from "./spreadsheet-tools.js";

const enc = (s: string) => new TextEncoder().encode(s);
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

/** An .xlsx built from raw parts, so the reader sees what Excel writes, not what buildXlsx writes. */
function workbook(sheets: Record<string, string>, extra: Record<string, string> = {}) {
  const names = Object.keys(sheets);
  const parts: Record<string, Uint8Array> = {
    "xl/workbook.xml": enc(
      `<workbook ${NS} xmlns:r="x"><sheets>${names
        .map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": enc(
      `<Relationships>${names
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://x/relationships/worksheet" Target="/xl/worksheets/sheet${i + 1}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
    "xl/sharedStrings.xml": enc(
      `<sst ${NS}><si><t>Name</t></si><si><t>Qty</t></si><si><r><t>Wid</t></r><r><t>get &amp; co</t></r></si><si><t>Due</t></si></sst>`,
    ),
    "xl/styles.xml": enc(
      `<styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd\\ hh:mm"/></numFmts><cellStyleXfs count="1"><xf numFmtId="14"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>`,
    ),
  };
  names.forEach((n, i) => {
    parts[`xl/worksheets/sheet${i + 1}.xml`] = enc(sheets[n] as string);
  });
  for (const [k, v] of Object.entries(extra)) parts[k] = enc(v);
  return zipSync(parts);
}
const sheet = (dimension: string, rows: string) =>
  `<worksheet ${NS}><dimension ref="${dimension}"/><sheetData>${rows}</sheetData></worksheet>`;

const SALES = sheet(
  "A1:F3",
  `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>3</v></c><c r="D1" t="inlineStr"><is><t>Active</t></is></c><c r="E1" t="str"><v>Total</v></c></row>` +
    `<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>3</v></c><c r="C2" s="1"><v>45000</v></c><c r="D2" t="b"><v>1</v></c><c r="E2"><f>B2*2</f><v>6.000000000000001</v></c><c r="F2" t="e"><v>#DIV/0!</v></c></row>` +
    `<row r="4"><c r="C4" s="2"><v>45000.5</v></c></row>`,
);

describe("read_spreadsheet: xlsx", () => {
  const bytes = workbook({
    Sales: SALES,
    "Q2 plan": sheet("A1:A1", `<row r="1"><c r="A1"><v>7</v></c></row>`),
  });

  it("lists sheets and reads strings, numbers, booleans, dates and formula results", () => {
    const read = readSpreadsheet(bytes, "xlsx", "book.xlsx");
    expect(read).toMatchObject({
      sheets: [
        { name: "Sales", dimension: "A1:F3" },
        { name: "Q2 plan", dimension: "A1:A1" },
      ],
      sheet: "Sales",
      columns: ["A", "B", "C", "D", "E", "F"],
      headerRow: 1,
      header: ["Name", "Qty", "Due", "Active", "Total", null],
      truncated: false,
    });
    expect((read as { rows: unknown[] }).rows).toEqual([
      [2, "Widget & co", 3, "2023-03-15", true, 6, "#DIV/0!"],
      [4, null, null, "2023-03-15T12:00:00", null, null, null],
    ]);
  });

  it("reads another sheet by name, ignoring case", () => {
    const read = readSpreadsheet(bytes, "xlsx", "book.xlsx", { sheet: "q2 PLAN" });
    expect(read).toMatchObject({ sheet: "Q2 plan", header: [7], rows: [] });
    expect(readSpreadsheet(bytes, "xlsx", "book.xlsx", { sheet: "Nope" })).toMatchObject({
      error: expect.stringContaining("Sales, Q2 plan"),
    });
  });

  it("applies a range and a row limit and flags truncation", () => {
    const rows = Array.from(
      { length: 50 },
      (_, i) =>
        `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c><c r="B${i + 1}"><v>${i * 2}</v></c></row>`,
    ).join("");
    const wide = workbook({ Data: sheet("A1:B50", rows) });
    const ranged = readSpreadsheet(wide, "xlsx", "d.xlsx", { range: "B10:B12" });
    expect(ranged).toMatchObject({ columns: ["B"], headerRow: 10, header: [18], truncated: false });
    expect((ranged as { rows: unknown[] }).rows).toEqual([
      [11, 20],
      [12, 22],
    ]);
    const limited = readSpreadsheet(wide, "xlsx", "d.xlsx", { maxRows: 5 });
    expect(limited).toMatchObject({ truncated: true });
    expect((limited as { rows: unknown[] }).rows).toHaveLength(4);
    expect(readSpreadsheet(wide, "xlsx", "d.xlsx", { range: "A1:B5", maxRows: 5 })).toMatchObject({
      truncated: false,
    });
    expect(readSpreadsheet(wide, "xlsx", "d.xlsx", { range: "nonsense" })).toHaveProperty("error");
  });

  it("stays under the caps for a zip bomb and for a huge sheet", () => {
    // ~120 MB of XML that deflates to a few hundred KB.
    const bomb = workbook({
      Boom: sheet("A1:A1", `<row r="1"><c r="A1"><v>1</v></c></row>${"<row/>".repeat(20_000_000)}`),
    });
    expect(bomb.byteLength).toBeLessThan(2_000_000);
    const started = Date.now();
    expect(readSpreadsheet(bomb, "xlsx", "bomb.xlsx")).toEqual({
      error: "The workbook is too large to read.",
    });
    expect(Date.now() - started).toBeLessThan(10_000);

    // Under the size cap but with far more rows than the limit.
    const big = workbook({
      Big: sheet(
        "A1:A400000",
        Array.from(
          { length: 400_000 },
          (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c></row>`,
        ).join(""),
      ),
    });
    const read = readSpreadsheet(big, "xlsx", "big.xlsx", { maxRows: 5_000 });
    expect(read).toMatchObject({ truncated: true });
    expect((read as { rows: unknown[] }).rows).toHaveLength(999);
  });

  it("returns values only for .xlsm and never opens the macro project", () => {
    const macro = workbook(
      { Sales: SALES },
      { "xl/vbaProject.bin": 'Sub AutoOpen() : Shell("calc") : End Sub' },
    );
    expect(spreadsheetKind("macros.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12")).toBe(
      "xlsx",
    );
    const read = readSpreadsheet(macro, "xlsx", "macros.xlsm") as { rows: unknown[] };
    expect(JSON.stringify(read)).not.toContain("AutoOpen");
    expect(read.rows[0]).toEqual([2, "Widget & co", 3, "2023-03-15", true, 6, "#DIV/0!"]);
  });

  it("refuses legacy .xls and unreadable files", () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3]);
    expect(readSpreadsheet(xls, "xlsx", "old.xlsx")).toHaveProperty("error");
    expect(readSpreadsheet(enc("not a zip"), "xlsx", "x.xlsx")).toHaveProperty("error");
    expect(spreadsheetKind("old.xls", "application/vnd.ms-excel")).toBe("xls");
  });
});

describe("read_spreadsheet: csv and tsv", () => {
  it("handles quotes, commas, newlines in a field, CRLF and a BOM", () => {
    const csv = '﻿name,note\r\n"Smith, Jo","said ""hi""\nthen left"\r\nplain,\r\n\r\n';
    const read = readSpreadsheet(enc(csv), "csv", "people.csv");
    expect(read).toMatchObject({
      sheet: "people",
      sheets: [{ name: "people", dimension: "A1:B4" }],
      header: ["name", "note"],
      truncated: false,
    });
    expect((read as { rows: unknown[] }).rows).toEqual([
      [2, "Smith, Jo", 'said "hi"\nthen left'],
      [3, "plain", null],
    ]);
  });

  it("reads tab-separated files and ranges", () => {
    const read = readSpreadsheet(enc("a\tb\tc\n1\t2\t3\n4\t5\t6"), "tsv", "t.tsv", {
      range: "B2:C3",
    });
    expect(read).toMatchObject({ columns: ["B", "C"], header: ["2", "3"], rows: [[3, "5", "6"]] });
  });
});

describe("create_spreadsheet", () => {
  it("round-trips through read_spreadsheet", () => {
    const made = createSpreadsheetBytes({
      sheets: [
        {
          name: "Budget: 2026/Q1",
          rows: [
            ["Item", "Cost", "Paid"],
            ["Rent", 1200.5, true],
            ["=1+1", null, "<b>&"],
          ],
        },
        { name: "budget: 2026/q1", rows: [["x"]] },
      ],
    });
    if ("error" in made) throw new Error(made.error);
    const read = readSpreadsheet(made.bytes, "xlsx", "b.xlsx");
    expect(read).toMatchObject({
      sheets: [{ name: "Budget  2026 Q1" }, { name: "budget  2026 q1 2" }],
      header: ["Item", "Cost", "Paid"],
    });
    expect((read as { rows: unknown[] }).rows).toEqual([
      [2, "Rent", 1200.5, true],
      [3, "=1+1", null, "<b>&"],
    ]);
  });

  it("rejects malformed input", () => {
    expect(createSpreadsheetBytes({ sheets: [] })).toHaveProperty("error");
    expect(createSpreadsheetBytes({ sheets: [{ name: "a", rows: "no" }] })).toHaveProperty("error");
    expect(buildXlsx([{ name: "a", rows: [[1]] }]).byteLength).toBeGreaterThan(0);
  });
});

describe("spreadsheet tools and attachments", () => {
  const sales = workbook({ Sales: SALES });
  const rows = [
    {
      id: "mine",
      spaceId: "s1",
      userId: "u1",
      name: "sales.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: sales.byteLength,
      storageKey: "k1",
    },
    {
      id: "theirs",
      spaceId: "s1",
      userId: "u2",
      name: "sales.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: sales.byteLength,
      storageKey: "k1",
    },
    {
      id: "elsewhere",
      spaceId: "s2",
      userId: "u1",
      name: "sales.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: sales.byteLength,
      storageKey: "k1",
    },
    {
      id: "doc",
      spaceId: "s1",
      userId: "u1",
      name: "notes.pdf",
      mimeType: "application/pdf",
      size: 3,
      storageKey: "k2",
    },
  ];
  const prisma = {
    artifact: {
      findFirst: async ({ where }: { where: { id: string; spaceId: string; userId: string } }) =>
        rows.find(
          (r) => r.id === where.id && r.spaceId === where.spaceId && r.userId === where.userId,
        ) ?? null,
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] }; spaceId: string; userId: string };
      }) =>
        rows.filter(
          (r) =>
            where.id.in.includes(r.id) && r.spaceId === where.spaceId && r.userId === where.userId,
        ),
    },
  };
  const artifacts = {
    get: async (key: string) => (key === "k1" ? sales : enc("%PDF")),
  } as unknown as ArtifactStore;
  const deps = {
    prisma,
    artifacts,
    scope: { spaceId: "s1", userId: "u1" },
    dataRoomEnabled: false,
  } as never;
  const context = { signal: new AbortController().signal } as never;

  it("reads the run user's artifact", async () => {
    expect(
      await readSpreadsheetTool(deps, context, { artifact_id: "mine", sheet: "Sales" }),
    ).toMatchObject({
      file: "sales.xlsx",
      sheet: "Sales",
      header: ["Name", "Qty", "Due", "Active", "Total", null],
    });
  });

  it("refuses another user's or another space's artifact, non-spreadsheets and Data room items", async () => {
    for (const id of ["theirs", "elsewhere", "missing"]) {
      expect(await readSpreadsheetTool(deps, context, { artifact_id: id })).toEqual({
        error: "File not found",
      });
    }
    expect(await readSpreadsheetTool(deps, context, { artifact_id: "doc" })).toEqual({
      error: "This is not an Excel or CSV file.",
    });
    expect(await readSpreadsheetTool(deps, context, { item_id: "i1" })).toEqual({
      error: "Data room items are not available to this agent.",
    });
    expect(await readSpreadsheetTool(deps, context, {})).toHaveProperty("error");
  });

  it("summarizes a spreadsheet attached to the turn", async () => {
    const block = (artifactId: string, name = "sales.xlsx") => ({
      kind: "file" as const,
      artifactId,
      name,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 1,
    });
    const summary = await spreadsheetAttachmentSummary(
      deps,
      [block("mine"), block("theirs")],
      context,
      { toolOffered: true },
    );
    expect(summary).toContain(
      'Attached spreadsheet "sales.xlsx" (artifact_id mine). Sheets: "Sales" A1:F3.',
    );
    expect(summary).toContain("1: Name | Qty | Due | Active | Total");
    expect(summary).toContain("2: Widget & co | 3 | 2023-03-15 | true | 6 | #DIV/0!");
    expect(summary).toContain("read_spreadsheet");
    expect(summary).not.toContain("theirs");
    const quiet = await spreadsheetAttachmentSummary(deps, [block("mine")], context, {
      toolOffered: false,
    });
    expect(quiet).not.toContain("read_spreadsheet");
    expect(
      await spreadsheetAttachmentSummary(deps, [block("doc", "notes.pdf")], context, {
        toolOffered: true,
      }),
    ).toBe("");
  });

  it("accepts spreadsheets as chat attachments", () => {
    expect(inferAttachmentMimeType("Q1.XLSX")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(inferAttachmentMimeType("m.xlsm", "application/octet-stream")).toBe(
      "application/vnd.ms-excel.sheet.macroEnabled.12",
    );
    expect(inferAttachmentMimeType("t.tsv")).toBe("text/tab-separated-values");
  });
});

describe("read_spreadsheet availability", () => {
  const base = {
    graphicalToolsAllowed: false,
    groupId: null,
    trigger: "user",
    semanticMemoryEnabled: false,
    messagingChannelRun: false,
  };
  const has = (over: object) =>
    selectBuiltinToolsForRun({ ...base, ...over }).some((t) => t.name === "read_spreadsheet");

  it("is offered to every kind of agent, with or without the Data room", () => {
    expect(has({})).toBe(true);
    expect(has({ cartaAgent: true })).toBe(true);
    expect(has({ integrationAgent: true, dataRoomEnabled: true })).toBe(true);
    expect(has({ integrationAgent: true, googleAgentProvider: "googledrive" })).toBe(true);
    expect(has({ disabledBuiltinTools: ["read_spreadsheet"] })).toBe(false);
    expect(LEGAL_AGENT_BUILTIN_TOOLS).toContain("read_spreadsheet");
    expect(DATA_ROOM_AGENT_BUILTIN_TOOLS).toContain("read_spreadsheet");
  });

  it("needs no approval, including on unattended webhook runs", () => {
    expect(unattendedTriggerToolRequiresApproval("webhook", "read_spreadsheet", false)).toBe(false);
  });
});

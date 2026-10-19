import { AutoSortPlanSchema } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { type AutoSortItem, buildAutoSortPlan, isMeaninglessName } from "./data-room-autosort.js";

// A messy room: a duplicate top-level folder with a sub-folder, screenshots, and an unfiled PDF.
const folders = [
  { id: "f-ben", name: "Benefits", parentId: null },
  { id: "f-ben2", name: "Benefits (2)", parentId: null },
  { id: "f-dental", name: "Dental and Vision", parentId: "f-ben2" },
  { id: "f-fin", name: "Finance", parentId: null },
  { id: "f-cap", name: "Cap Table", parentId: "f-fin" },
];
const item = (id: string, name: string, folderId: string | null, extra = {}): AutoSortItem => ({
  id,
  name,
  folderId,
  docType: "other",
  docDate: null,
  parties: [],
  tags: [],
  summary: null,
  ...extra,
});
const items = [
  item("i-plan", "Plan summary.pdf", "f-ben"),
  item("i-dental", "dental-2026.pdf", "f-dental"),
  item("i-shot1", "Screenshot 2026-10-18 at 9.10.50 AM.png", "f-cap", {
    docType: "spreadsheet",
    parties: ["Example Co"],
    docDate: new Date("2026-10-18T00:00:00Z"),
  }),
  item("i-shot2", "Screenshot 2026-10-18 at 9.11.02 AM.png", "f-cap"),
  item("i-pdf", "scan0001.pdf", null),
];

describe("buildAutoSortPlan", () => {
  it("merges 'Benefits (2)' into 'Benefits' without a model", () => {
    const plan = buildAutoSortPlan({ folders, items, proposal: null });
    expect(plan.mode).toBe("basic");
    expect(plan.operations).toEqual([
      expect.objectContaining({
        type: "merge_folder",
        folderId: "f-ben2",
        intoFolderId: "f-ben",
        from: "Benefits (2)",
        into: "Benefits",
      }),
    ]);
  });

  it("moves items to their targets and renames screenshot names, keeping the extension", () => {
    const plan = buildAutoSortPlan({
      folders,
      items,
      proposal: {
        items: [
          { id: "i-plan", folderPath: ["benefits", "Health"] },
          // Already where the merge puts it: no move.
          { id: "i-dental", folderPath: ["Benefits", "Dental and Vision"] },
          {
            id: "i-shot1",
            folderPath: ["Finance", "Cap Table"],
            name: "Cap table - Example Co - 2026-10-18",
          },
          {
            id: "i-shot2",
            folderPath: ["Finance", "Cap Table"],
            name: "Cap table - Example Co - 2026-10-18.png",
          },
          {
            id: "i-pdf",
            folderPath: ["Legal"],
            name: "Offer letter - Example Co.pdf",
          },
        ],
      },
    });
    expect(plan.mode).toBe("ai");
    const moves = plan.operations.filter((o) => o.type === "move_item");
    expect(moves.map((o) => [o.itemId, o.toPath])).toEqual([
      ["i-plan", ["Benefits", "Health"]],
      ["i-pdf", ["Legal"]],
    ]);
    const renames = plan.operations.filter((o) => o.type === "rename_item");
    expect(renames.map((o) => o.toName)).toEqual([
      "Cap table - Example Co - 2026-10-18.png",
      "Cap table - Example Co - 2026-10-18 (2).png",
      "Offer letter - Example Co.pdf",
    ]);
  });

  it("does not rename a good name", () => {
    const plan = buildAutoSortPlan({
      folders,
      items,
      proposal: { items: [{ id: "i-plan", folderPath: ["Benefits"], name: "Other.pdf" }] },
    });
    expect(plan.operations.some((o) => o.type === "rename_item")).toBe(false);
  });

  it.each([
    ["an unknown id", { items: [{ id: "nope", folderPath: ["A"] }] }],
    ["a slash in a folder", { items: [{ id: "i-plan", folderPath: ["A/B"] }] }],
    ["a slash in a name", { items: [{ id: "i-pdf", folderPath: ["A"], name: "a/b.pdf" }] }],
    ["a delete", { items: [{ id: "i-plan", folderPath: ["A"] }], delete: ["i-plan"] }],
    ["a delete flag on an item", { items: [{ id: "i-plan", folderPath: ["A"], delete: true }] }],
    [
      "a repeated id",
      {
        items: [
          { id: "i-plan", folderPath: ["A"] },
          { id: "i-plan", folderPath: ["B"] },
        ],
      },
    ],
  ])("rejects the whole answer with %s", (_label, proposal) => {
    const plan = buildAutoSortPlan({ folders, items, proposal });
    expect(plan.mode).toBe("basic");
    expect(plan.operations.map((o) => o.type)).toEqual(["merge_folder"]);
  });

  it("recognizes meaningless names", () => {
    expect(
      [
        "Screenshot 2026-10-18 at 9.10.50 AM.png",
        "scan0001.pdf",
        "IMG_4032.HEIC",
        "Untitled.docx",
        "123.pdf",
      ].every(isMeaninglessName),
    ).toBe(true);
    expect(
      ["Plan summary.pdf", "Scanner manual.pdf", "Image rights.pdf"].some(isMeaninglessName),
    ).toBe(false);
  });

  it("groups new folders that differ only in case or a (2) suffix, using the first spelling", () => {
    const plan = buildAutoSortPlan({
      folders,
      items,
      proposal: {
        items: [
          { id: "i-plan", folderPath: ["Taxes"] },
          { id: "i-dental", folderPath: ["taxes (2)"] },
          { id: "i-pdf", folderPath: ["TAXES"] },
        ],
      },
    });
    const moves = plan.operations.filter((o) => o.type === "move_item");
    expect(moves.map((o) => o.toPath)).toEqual([["Taxes"], ["Taxes"], ["Taxes"]]);
  });

  it("shortens long folder labels and caps the operations", () => {
    const long = "x".repeat(250);
    const dupes = Array.from({ length: 6 }, (_, n) => [
      { id: `d${n}`, name: `Dup ${n}`, parentId: null },
      { id: `e${n}`, name: `Dup ${n} (2)`, parentId: null },
    ]).flat();
    const many = Array.from({ length: 500 }, (_, n) => item(`n${n}`, `scan${n}.pdf`, null));
    const plan = buildAutoSortPlan({
      folders: [
        ...dupes,
        { id: "f-long", name: long, parentId: null },
        { id: "f-long2", name: `${long} (2)`, parentId: "f-long" },
      ],
      items: many,
      proposal: {
        items: many.map((m, n) => ({ id: m.id, folderPath: [`A${n % 2}`], name: `Doc ${n}` })),
      },
    });
    expect(plan.operations.length).toBe(1000);
    expect(AutoSortPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("says why a plan has no model proposal", () => {
    expect(buildAutoSortPlan({ folders, items, proposal: { nope: 1 } }).reason).toBe("ai_failed");
  });
});

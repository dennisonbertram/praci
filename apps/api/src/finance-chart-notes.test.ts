import type { Actor } from "@rakazo/contracts";
import { FinanceChartNoteAddInputSchema } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import type { FinanceDeps } from "./finance.js";
import { financeChartNoteAdd, financeChartNoteDelete, financeChartNotes } from "./finance.js";

const actor = (userId: string, spaceId: string): Actor => ({
  userId,
  spaceId,
  email: `${userId}@rakazo.test`,
  isDeploymentOwner: false,
});
const a = actor("user-a", "space-1");
const b = actor("user-b", "space-1");
const c = actor("user-c", "space-2");

type Row = { id: string; spaceId: string; userId: string; day: string; text: string };

/** Applies the where fields the handlers use: equality plus a day range. */
function fakeDeps() {
  const rows: Row[] = [];
  const match = (r: Row, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => {
      if (k === "day" && v && typeof v === "object") {
        const { gte, lte } = v as { gte: string; lte: string };
        return r.day >= gte && r.day <= lte;
      }
      return (r as Record<string, unknown>)[k] === v;
    });
  const financeChartNote = {
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      rows.filter((r) => match(r, where)),
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((r) => match(r, where)) ?? null,
    create: async ({ data }: { data: Omit<Row, "id"> }) => {
      const row = { id: `n${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const gone = rows.filter((r) => match(r, where));
      for (const r of gone) rows.splice(rows.indexOf(r), 1);
      return { count: gone.length };
    },
  };
  return { deps: { prisma: { financeChartNote } } as unknown as FinanceDeps, rows };
}

describe("finance chart notes", () => {
  it("shows a note to every member of the Space, marked mine only for its author", async () => {
    const { deps } = fakeDeps();
    await financeChartNoteAdd(deps, a, { day: "2026-08-01", text: "Hired two engineers" });
    const range = { from: "2026-08-01", to: "2026-08-31" };
    expect(await financeChartNotes(deps, a, range)).toMatchObject([{ mine: true }]);
    expect(await financeChartNotes(deps, b, range)).toMatchObject([
      { day: "2026-08-01", text: "Hired two engineers", mine: false },
    ]);
  });

  it("never lists another Space's notes and filters by the day range", async () => {
    const { deps } = fakeDeps();
    await financeChartNoteAdd(deps, a, { day: "2026-08-01", text: "in range" });
    await financeChartNoteAdd(deps, a, { day: "2026-01-01", text: "out of range" });
    await financeChartNoteAdd(deps, c, { day: "2026-08-01", text: "other space" });
    const notes = await financeChartNotes(deps, a, { from: "2026-08-01", to: "2026-08-31" });
    expect(notes.map((n) => n.text)).toEqual(["in range"]);
  });

  it("lets only the author delete; a Space member is forbidden, another Space finds nothing", async () => {
    const { deps, rows } = fakeDeps();
    const note = await financeChartNoteAdd(deps, a, { day: "2026-08-01", text: "mine" });
    await expect(financeChartNoteDelete(deps, b, { id: note.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(financeChartNoteDelete(deps, c, { id: note.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(rows).toHaveLength(1);
    await financeChartNoteDelete(deps, a, { id: note.id });
    expect(rows).toHaveLength(0);
  });

  it("validates the day and trims the text, requiring some", () => {
    const parse = (day: string, text: string) =>
      FinanceChartNoteAddInputSchema.safeParse({ day, text });
    expect(parse("2026-08-01", "  hi  ")).toMatchObject({ data: { text: "hi" } });
    expect(parse("2026-08-01", "   ").success).toBe(false);
    expect(parse("2026-02-30", "x").success).toBe(false);
    expect(parse("2026-08-01", "x".repeat(501)).success).toBe(false);
  });
});

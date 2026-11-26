import type { EquityTransaction } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { activityCsv, csvCell } from "./activity-csv";

const row: EquityTransaction = {
  id: "tx1",
  kind: "issue",
  effectiveDate: "2026-01-15",
  reason: null,
  certificateId: "c1",
  convertibleId: null,
  optionGrantId: null,
  planId: null,
  securityLabel: "CS-1",
  quantity: "1000",
  valueCents: null,
  before: null,
  after: { quantity: "1000" },
  resulting: [],
  note: 'Board said "yes", later',
  actorName: "=HYPERLINK()",
  createdAt: "2026-01-15T10:00:00.000Z",
};

describe("activityCsv", () => {
  it("writes the header and one quoted row per change", () => {
    const [header, line] = activityCsv([row]).split("\r\n");
    expect(header).toBe(
      "recorded,effective_date,kind,security,quantity,value_cents,actor,note,before,after",
    );
    expect(line).toBe(
      `2026-01-15T10:00:00.000Z,2026-01-15,issue,CS-1,1000,,'=HYPERLINK(),"Board said ""yes"", later",,"{""quantity"":""1000""}"`,
    );
  });

  it("guards formulas and quotes line breaks", () => {
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });
});

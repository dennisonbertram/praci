import { describe, expect, it } from "vitest";
import { MeetingDigestSchema } from "./meeting-digest.js";

const base = { decisions: [], commitments: [], followUps: [] };

describe("MeetingDigestSchema category", () => {
  it("parses a digest stored before the field existed", () => {
    expect(MeetingDigestSchema.parse(base).category).toBe("other");
  });
  it("keeps each known value and turns anything else into other", () => {
    for (const c of ["investor", "customer", "hiring", "team", "other"])
      expect(MeetingDigestSchema.parse({ ...base, category: c }).category).toBe(c);
    expect(MeetingDigestSchema.parse({ ...base, category: "Investor" }).category).toBe("other");
    expect(MeetingDigestSchema.parse({ ...base, category: { x: 1 } }).category).toBe("other");
  });
});

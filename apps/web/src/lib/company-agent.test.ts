import { describe, expect, it } from "vitest";
import { findCompanyAgent } from "./company-agent";

describe("Company page agents", () => {
  const bots = [
    { spawnKey: "company-agent:other" },
    { spawnKey: "company-importer:owner" },
    { spawnKey: "company-agent:owner" },
  ];
  it("selects only the owner's matching page agent", () => {
    expect(findCompanyAgent(bots, "owner")).toBe(bots[2]);
    expect(findCompanyAgent(bots, "owner", true)).toBe(bots[1]);
    expect(findCompanyAgent(bots, "absent")).toBeUndefined();
    expect(findCompanyAgent(bots, null)).toBeUndefined();
  });
});

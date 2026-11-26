import { describe, expect, it } from "vitest";
import { approvalTitle, isApprovalTitle } from "./approval-title.js";

describe("approval title", () => {
  it("round-trips and keeps the wording", () => {
    expect(approvalTitle("Mercury agent")).toBe("Mercury agent needs approval");
    expect(isApprovalTitle(approvalTitle("X"))).toBe(true);
  });
  it("does not match other needs_input titles", () => {
    expect(isApprovalTitle("Approval needed")).toBe(false);
    expect(isApprovalTitle("Which file?")).toBe(false);
  });
});

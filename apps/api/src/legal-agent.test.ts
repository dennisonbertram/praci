import { expect, test } from "vitest";
import { LEGAL_AGENT_INSTRUCTIONS } from "./legal-agent.js";

test("the Legal agent points sending to the Inbox agent instead of blaming the connection", () => {
  expect(LEGAL_AGENT_INSTRUCTIONS).toContain("never say email is not connected");
});

test("the removal instruction names the arguments legal_upsert_deadline requires", () => {
  expect(LEGAL_AGENT_INSTRUCTIONS).toContain(
    'its current title, dueDate and kind, and status "dismissed"',
  );
});

import { expect, test } from "vitest";
import { LEGAL_AGENT_INSTRUCTIONS } from "./legal-agent.js";

test("the Legal agent points sending to the Inbox agent instead of blaming the connection", () => {
  expect(LEGAL_AGENT_INSTRUCTIONS).toContain("never say email is not connected");
});

import { humanizeToolName } from "@rakazo/core";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import { internalToolLabel } from "./working-label";

it("names agent-to-agent messaging as asking another agent", () => {
  expect(internalToolLabel(humanizeToolName("message_bot"))).toBe("Asking another agent");
});

it("shows internal calls as Thinking and leaves other tools alone", () => {
  expect(internalToolLabel(humanizeToolName("skill_read"))).toBe("Thinking");
  expect(internalToolLabel("Search the web")).toBeUndefined();
});

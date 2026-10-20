import { i18n } from "@lingui/core";
import { expect, it } from "vitest";

import { toolActionLabel } from "./working-label";

i18n.loadAndActivate({ locale: "en", messages: {} });

it("names the agent being asked, or falls back when it is unknown", () => {
  expect(toolActionLabel("ask-agent", "Gmail")).toBe("Asking Gmail");
  expect(toolActionLabel("ask-agent")).toBe("Asking another agent");
});

it("words the user message and internal calls plainly", () => {
  expect(toolActionLabel("message-user")).toBe("Messaging you");
  expect(toolActionLabel("thinking")).toBe("Thinking");
  expect(toolActionLabel(undefined)).toBeUndefined();
});

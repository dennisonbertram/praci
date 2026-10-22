import { afterEach, describe, expect, it } from "vitest";
import { openChatBotId, setDockedAgentBotId } from "./docked-agent";
import { resultShownInOpenChat } from "./notification-delivery";

afterEach(() => setDockedAgentBotId(undefined));

describe("openChatBotId", () => {
  it("counts the bot in the docked panel as open, and not another bot", () => {
    setDockedAgentBotId("legal");
    const open = openChatBotId(undefined);
    expect(resultShownInOpenChat({ botId: "legal", kind: "needs_input" }, open, true)).toBe(true);
    expect(resultShownInOpenChat({ botId: "finance", kind: "needs_input" }, open, true)).toBe(
      false,
    );
  });
  it("prefers the route bot and falls back to none", () => {
    setDockedAgentBotId("legal");
    expect(openChatBotId("b1")).toBe("b1");
    setDockedAgentBotId(undefined);
    expect(openChatBotId(undefined)).toBeUndefined();
  });
});

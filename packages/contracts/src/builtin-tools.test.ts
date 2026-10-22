import { describe, expect, it } from "vitest";
import { BUILTIN_TOOL_NAMES } from "./builtin-tools.js";
import {
  isVoiceAgentSpawnKey,
  VOICE_AGENT_BUILTIN_TOOLS,
  voiceAgentSpawnKey,
} from "./voice-agent.js";

describe("voice agent tool contract", () => {
  it("registers every allowed voice tool as a builtin", () => {
    for (const name of VOICE_AGENT_BUILTIN_TOOLS) {
      expect(BUILTIN_TOOL_NAMES).toContain(name);
    }
  });

  it("recognizes reserved voice-agent spawn keys", () => {
    expect(isVoiceAgentSpawnKey(voiceAgentSpawnKey("user-1"))).toBe(true);
    expect(isVoiceAgentSpawnKey("voice-agent:")).toBe(true);
    expect(isVoiceAgentSpawnKey("custom-bot")).toBe(false);
    expect(isVoiceAgentSpawnKey(null)).toBe(false);
  });
});

describe("GTM posting tool contract", () => {
  it("registers the app-owned post name without adding it to generic GTM tools", async () => {
    const { GTM_AGENT_BUILTIN_TOOLS } = await import("./gtm.js");

    expect(BUILTIN_TOOL_NAMES).toContain("gtm_post");
    expect(GTM_AGENT_BUILTIN_TOOLS).not.toContain("gtm_post");
  });
});

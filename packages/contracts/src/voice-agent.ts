export const voiceAgentSpawnKey = (userId: string) => `voice-agent:${userId}`;

/** Replaces the key of an archived Elio whose key a new Elio took, so it stays Elio-restricted. */
export const retiredVoiceAgentSpawnKey = (botId: string) => `voice-agent-retired:${botId}`;

export const isRetiredVoiceAgentSpawnKey = (spawnKey: string | null | undefined): boolean =>
  Boolean(spawnKey?.startsWith(retiredVoiceAgentSpawnKey("")));

export const isVoiceAgentSpawnKey = (spawnKey: string | null | undefined): boolean =>
  Boolean(spawnKey?.startsWith(voiceAgentSpawnKey(""))) || isRetiredVoiceAgentSpawnKey(spawnKey);

export const VOICE_AGENT_BUILTIN_TOOLS = [
  "workspace_agents",
  "agent_context",
  "search_agent_history",
  "read_agent_history",
  "search_data_room",
  "read_data_room_item",
  "board_tickets",
  "ticket_get",
  "message_bot",
  "message_user",
  "ask_user",
  "end_call",
] as const;

export const voiceAgentSpawnKey = (userId: string) => `voice-agent:${userId}`;

export const isVoiceAgentSpawnKey = (spawnKey: string | null | undefined): boolean =>
  Boolean(spawnKey?.startsWith(voiceAgentSpawnKey("")));

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

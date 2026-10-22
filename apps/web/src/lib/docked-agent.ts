let dockedAgentBotId: string | undefined;

/** The page agent shown in the docked panel, set by the Shell; undefined when no panel is open. */
export function setDockedAgentBotId(botId: string | undefined) {
  dockedAgentBotId = botId;
}

/** The bot whose chat is on screen: the docked panel's (page routes like /app/legal also match :botId), else the route's. */
export function openChatBotId(routeBotId: string | undefined): string | undefined {
  return dockedAgentBotId ?? routeBotId;
}

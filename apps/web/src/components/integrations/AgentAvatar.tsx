import { BotAvatar } from "@rakazo/ui-web";
import type { ComponentProps } from "react";
import type { AgentApp } from "../../lib/agent-app";
import { AppLogo } from "./AppLogo";

/** A bot's avatar; an integration agent shows the logo of the app it owns instead. */
export function AgentAvatar({
  app,
  size = 36,
  ...avatar
}: ComponentProps<typeof BotAvatar> & { app?: AgentApp }) {
  if (!app) return <BotAvatar size={size} {...avatar} />;
  return (
    <AppLogo name={app.name} logo={app.logo} size={size <= 24 ? "sm" : size <= 40 ? "md" : "lg"} />
  );
}

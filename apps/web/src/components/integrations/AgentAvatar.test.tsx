import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { agentApp } from "../../lib/agent-app";
import { AgentAvatar } from "./AgentAvatar";

describe("AgentAvatar", () => {
  it("shows the app logo for an integration agent and the bot face otherwise", () => {
    const logo = renderToString(
      <AgentAvatar color="#F97316" app={{ name: "Acme", logo: "/logos/acme.svg" }} />,
    );
    expect(logo).toContain('data-testid="app-logo"');
    expect(renderToString(<AgentAvatar color="#F97316" />)).not.toContain("app-logo");
  });
});

describe("agentApp", () => {
  const data = {
    connections: [{ provider: "googlecalendar", displayName: "Work", agentBotId: "b_cal" }],
    servers: [{ name: "Mercury", endpoint: null, agentBotId: "b_merc" }],
    catalog: [{ slug: "GOOGLECALENDAR", name: "Google Calendar", logo: "/cal.svg" }],
  };
  it("resolves integration agents only", () => {
    expect(agentApp({ id: "b_cal", spawnKey: "integration-agent:c1" }, data)).toEqual({
      name: "Google Calendar",
      logo: "/cal.svg",
    });
    expect(agentApp({ id: "b_merc", spawnKey: "integration-agent:s1" }, data)?.logo).toBe(
      "/logos/mercury.svg",
    );
    expect(agentApp({ id: "b_cal", spawnKey: "inbox-agent:u1" }, data)).toBeUndefined();
    expect(agentApp({ id: "b_x", spawnKey: null }, data)).toBeUndefined();
  });
});

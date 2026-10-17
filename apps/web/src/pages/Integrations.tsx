import { Route, Routes } from "react-router-dom";
import { AppDetail } from "../components/integrations/AppDetail";
import { IntegrationsHome } from "../components/integrations/IntegrationsHome";
import { McpDetail } from "../components/integrations/McpDetail";
import { useIntegrations } from "../components/integrations/useIntegrations";
import { IntegrationSetupPage } from "./IntegrationSetup";

/** The Integrations page: home, app and MCP server detail, and server setup, in the shell's main pane. */
export function IntegrationsPage({ activeBotId }: { activeBotId?: string }) {
  const data = useIntegrations();
  return (
    <Routes>
      <Route
        path="app/:connectorId/:slug"
        element={<AppDetail data={data} activeBotId={activeBotId} />}
      />
      <Route path="mcp/:serverId" element={<McpDetail data={data} />} />
      <Route path="setup" element={<IntegrationSetupPage />} />
      <Route path="*" element={<IntegrationsHome data={data} activeBotId={activeBotId} />} />
    </Routes>
  );
}

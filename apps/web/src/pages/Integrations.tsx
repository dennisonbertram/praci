import { Navigate, Route, Routes } from "react-router-dom";
import { AppDetail } from "../components/integrations/AppDetail";
import { GranolaPage } from "../components/integrations/GranolaPage";
import { IntegrationsHome } from "../components/integrations/IntegrationsHome";
import { McpDetail } from "../components/integrations/McpDetail";
import { OmiPage } from "../components/integrations/OmiPage";
import { OmiTrash } from "../components/integrations/OmiSegments";
import { SourceDetail } from "../components/integrations/SourceDetail";
import { useIntegrations } from "../components/integrations/useIntegrations";
import { IntegrationSetupPage } from "./IntegrationSetup";

/** The Integrations page: home, app and MCP server detail, and server setup, in the shell's main pane. */
export function IntegrationsPage({
  activeBotId,
  onOpenMessaging,
  onOpenAiDataSharing,
  onOpenVoiceSettings,
}: {
  activeBotId?: string;
  onOpenMessaging?: () => void;
  onOpenAiDataSharing?: () => void;
  onOpenVoiceSettings?: () => void;
}) {
  const data = useIntegrations();
  return (
    <Routes>
      <Route
        path="app/:connectorId/:slug"
        element={<AppDetail data={data} activeBotId={activeBotId} />}
      />
      <Route
        path="granola"
        element={<GranolaPage data={data} onOpenAiDataSharing={onOpenAiDataSharing} />}
      />
      <Route
        path="granola/meetings"
        element={<Navigate replace to="/app/meetings?source=granola" />}
      />
      <Route
        path="omi"
        element={<OmiPage data={data} onOpenVoiceSettings={onOpenVoiceSettings} />}
      />
      <Route path="omi/trash" element={<OmiTrash />} />
      <Route path="mcp/:serverId" element={<McpDetail data={data} />} />
      <Route path="source/:sourceId" element={<SourceDetail data={data} />} />
      <Route path="setup" element={<IntegrationSetupPage />} />
      <Route
        path="*"
        element={
          <IntegrationsHome
            data={data}
            activeBotId={activeBotId}
            onOpenMessaging={onOpenMessaging}
          />
        }
      />
    </Routes>
  );
}

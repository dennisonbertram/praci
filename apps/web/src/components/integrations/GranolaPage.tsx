import { Trans, useLingui } from "@lingui/react/macro";
import { GRANOLA_MCP_ENDPOINT, isGranolaEndpoint } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLogo } from "./AppLogo";
import { CustomConnectionDialog } from "./CustomConnectionDialog";
import { GranolaMeetingsCard } from "./GranolaMeetingsCard";
import { McpDetail } from "./McpDetail";
import type { IntegrationsData } from "./useIntegrations";

/** The Granola page at /app/integrations/granola. With a sign-in server it is McpDetail plus the key card. */
export function GranolaPage({
  data,
  onOpenAiDataSharing,
}: {
  data: IntegrationsData;
  onOpenAiDataSharing?: () => void;
}) {
  const { t } = useLingui();
  const [signingIn, setSigningIn] = useState(false);
  const server = data.servers.find((entry) => isGranolaEndpoint(entry.endpoint));
  if (server)
    return <McpDetail data={data} serverId={server.id} onOpenAiDataSharing={onOpenAiDataSharing} />;
  const name = "Granola";
  const key = data.meetings ?? null;
  return (
    <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
      <div className="mx-auto max-w-[1040px]">
        <Link
          to="/app/integrations"
          className="mb-3.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <Trans>Apps</Trans>
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <AppLogo name={name} size="xl" />
          <h1 className="text-xl font-semibold">{name}</h1>
          <Button
            className="ms-auto"
            variant={key && key.status !== "disconnected" ? "outline" : "default"}
            aria-label={t`Connect ${name}`}
            onClick={() => setSigningIn(true)}
          >
            <Trans>Connect</Trans>
          </Button>
        </div>
        <div className="mt-6">
          <GranolaMeetingsCard
            status={key}
            bothRoutes={false}
            agentName={
              data.bots.find((bot) => bot.id === key?.agentBotId)?.name ?? t`Granola agent`
            }
            onChanged={() => void data.refresh()}
            onOpenAiDataSharing={onOpenAiDataSharing}
          />
        </div>
      </div>
      {signingIn ? (
        <CustomConnectionDialog
          data={data}
          initialUrl={GRANOLA_MCP_ENDPOINT}
          service="Granola"
          onClose={() => setSigningIn(false)}
        />
      ) : null}
    </div>
  );
}

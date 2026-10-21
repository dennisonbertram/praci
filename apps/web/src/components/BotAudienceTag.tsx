import { Trans } from "@lingui/react/macro";
import { Badge } from "@rakazo/ui-web";

/** Marks a bot that talks to people outside the company. Internal bots show nothing. */
export function BotAudienceTag() {
  return (
    <Badge variant="outline" data-testid="bot-audience-tag" className="shrink-0">
      <Trans>External</Trans>
    </Badge>
  );
}

import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { MessageSquare } from "lucide-react";

/** The one way a page (Inbox, Finance, Cap table) opens its bot's side panel. */
export function AskBotButton({ botName, onClick }: { botName: string; onClick: () => void }) {
  const { t } = useLingui();
  return (
    <Button
      variant="outline"
      className="pointer-coarse:h-10"
      aria-label={t`Ask ${botName}`}
      onClick={onClick}
    >
      <MessageSquare aria-hidden="true" />
      <Trans>Ask</Trans>
    </Button>
  );
}

import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { MessageSquare } from "lucide-react";

/** The one way a page (Inbox, Finance, Cap table) opens its bot's side panel. */
export function AskBotButton({
  botName,
  onClick,
  compact = false,
}: {
  botName: string;
  onClick: () => void;
  /** Icon only on a phone, so the button shares the title's row. */
  compact?: boolean;
}) {
  const { t } = useLingui();
  return (
    <Button
      variant="outline"
      className={
        compact
          ? "pointer-coarse:h-10 max-sm:w-8 max-sm:px-0 pointer-coarse:max-sm:w-10"
          : "pointer-coarse:h-10"
      }
      aria-label={t`Ask ${botName}`}
      onClick={onClick}
    >
      <MessageSquare aria-hidden="true" />
      <span className={compact ? "max-sm:sr-only" : undefined}>
        <Trans>Ask</Trans>
      </span>
    </Button>
  );
}

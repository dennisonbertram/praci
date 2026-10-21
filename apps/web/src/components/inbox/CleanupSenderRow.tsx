import { Trans, useLingui } from "@lingui/react/macro";
import type { CleanupSender } from "@rakazo/contracts";
import { Button, Checkbox } from "@rakazo/ui-web";
import { formatMailTime } from "../../lib/mail-time";

/** One sender of the cleanup list: tick to include it, with how much mail it sent and how little was read. */
export function CleanupSenderRow({
  sender,
  checked,
  onToggle,
  accountLabel,
  onStop,
  onForgetLearned,
  disabled = false,
}: {
  sender: CleanupSender;
  checked: boolean;
  onToggle: () => void;
  /** The account's name, shown when the list covers more than one. */
  accountLabel?: string;
  /** Forgets the sender's skip decision; shown only on a sender that is skipping the inbox. */
  onStop?: () => void;
  /** Forgets the learned pile; shown only on a sender that has one. */
  onForgetLearned?: () => void;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  const pileNames = { important: t`Important`, updates: t`Updates`, newsletters: t`Newsletters` };
  const readPercent = Math.round((sender.readCount / Math.max(sender.messageCount, 1)) * 100);
  return (
    <div
      data-sender={sender.address}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-foreground/10 px-1 py-2.5"
    >
      <Checkbox
        className="relative after:absolute after:-inset-3.5"
        aria-label={t`Select ${sender.name}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span dir="auto" className="max-w-[70%] shrink-0 truncate text-[15px] font-semibold">
            {sender.name}
          </span>
          <span dir="auto" className="min-w-0 truncate text-sm text-muted-foreground">
            {sender.address}
          </span>
        </div>
        {accountLabel || sender.spamLike || sender.skipInbox || sender.learnedPile ? (
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {accountLabel ? <span dir="auto">{accountLabel}</span> : null}
            {sender.spamLike ? (
              <span className="text-warning">
                <Trans>Looks like spam</Trans>
              </span>
            ) : null}
            {sender.skipInbox ? (
              <span className="flex items-center gap-1">
                <Trans>Skipping</Trans>
                {onStop ? (
                  <Button
                    variant="link"
                    size="xs"
                    className="h-auto p-0 text-xs"
                    onClick={onStop}
                    disabled={disabled}
                  >
                    <Trans>Stop</Trans>
                  </Button>
                ) : null}
                {sender.rule === "full" ? (
                  <span>
                    <Trans>Gmail filter limit reached</Trans>
                  </span>
                ) : sender.rule === "failed" ? (
                  <span>
                    <Trans>Couldn't add Gmail filter</Trans>
                  </span>
                ) : null}
              </span>
            ) : null}
            {sender.learnedPile ? (
              <span className="flex items-center gap-1">
                <Trans>Learned</Trans> {pileNames[sender.learnedPile as keyof typeof pileNames]}
                {onForgetLearned ? (
                  <Button
                    variant="link"
                    size="xs"
                    className="h-auto p-0 text-xs"
                    onClick={onForgetLearned}
                    disabled={disabled}
                  >
                    <Trans>Forget</Trans>
                  </Button>
                ) : null}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="text-end text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        <span>{sender.messageCount}</span>
        <span aria-hidden="true"> · </span>
        <span>{t`${readPercent}% read`}</span>
        {sender.lastReceivedAt ? (
          <>
            <span aria-hidden="true"> · </span>
            <time dateTime={sender.lastReceivedAt}>{formatMailTime(sender.lastReceivedAt)}</time>
          </>
        ) : null}
      </div>
    </div>
  );
}

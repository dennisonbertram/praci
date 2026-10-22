import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { NotificationKind } from "@rakazo/contracts";
import { StatusIcon } from "@rakazo/ui-web";
import { needsAnswerLabel } from "../lib/roster-status";

/**
 * The right side of a page row: a dot while the page has unseen notifications, otherwise its glance
 * value (nothing when there is none). The rail shows only the dot, so a value never turns into one.
 */
export function glanceBadge({
  unseen,
  value,
  valueLabel,
  failure = false,
  onValueClick,
  rail,
}: {
  unseen: number;
  value?: string;
  /** What the value means in words, for the row's accessible name. */
  valueLabel?: string;
  /** The value counts failures, so it takes the destructive color instead of the muted one. */
  failure?: boolean;
  /** Makes the value its own button (for example the failed count opens the failed files). */
  onValueClick?: () => void;
  rail: boolean;
}) {
  if (unseen > 0) {
    return {
      notified: true,
      badgeLabel: t`new`,
      badge: (
        <span
          data-testid="glance-dot"
          aria-hidden="true"
          className="ms-auto size-2 rounded-full bg-primary"
        />
      ),
    };
  }
  if (!value || rail) return { badge: null, badgeLabel: undefined };
  return {
    badgeLabel: valueLabel,
    onBadgeClick: onValueClick,
    badge: (
      <span
        data-testid="glance-value"
        title={valueLabel}
        className={`ms-auto text-[11.5px] tabular-nums ${failure ? "font-medium text-destructive" : "text-muted-foreground"}`}
      >
        {value}
      </span>
    ),
  };
}

const KIND_LABEL: Record<NotificationKind, () => React.ReactNode> = {
  urgent: () => <Trans> (urgent)</Trans>,
  needs_input: () => <Trans> (needs your answer)</Trans>,
  failed: () => <Trans> (failed)</Trans>,
  done: () => <Trans> (done)</Trans>,
  new: () => <Trans> (new)</Trans>,
};

const KIND_TITLE: Record<NotificationKind, () => string> = {
  urgent: () => t`Urgent`,
  needs_input: needsAnswerLabel,
  failed: () => t`Failed`,
  done: () => t`Done`,
  new: () => t`New`,
};

/**
 * Beside an agent's timestamp while it has unseen notifications: the icon of the highest-priority
 * kind. `botId` seeds the animation so rows do not move in lockstep.
 */
export function StatusMark({ kind, botId }: { kind: NotificationKind; botId: string }) {
  return (
    <span className="inline-flex text-foreground" data-kind={kind} title={KIND_TITLE[kind]()}>
      <StatusIcon kind={kind} size={16} seed={botId} />
      <span className="sr-only">{KIND_LABEL[kind]()}</span>
    </span>
  );
}

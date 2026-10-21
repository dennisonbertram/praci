import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { NotificationKind } from "@rakazo/contracts";
import { StatusIcon } from "@rakazo/ui-web";

/**
 * The right side of a page row: a dot while the page has unseen notifications, otherwise its glance
 * value (nothing when there is none). The rail shows only the dot, so a value never turns into one.
 */
export function glanceBadge({
  unseen,
  value,
  valueLabel,
  rail,
}: {
  unseen: number;
  value?: string;
  /** What the value means in words, for the row's accessible name. */
  valueLabel?: string;
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
    badge: (
      <span
        data-testid="glance-value"
        className="ms-auto text-[11.5px] text-muted-foreground tabular-nums"
      >
        {value}
      </span>
    ),
  };
}

const KIND_LABEL: Record<NotificationKind, () => React.ReactNode> = {
  urgent: () => <Trans> (urgent)</Trans>,
  needs_input: () => <Trans> (needs input)</Trans>,
  failed: () => <Trans> (failed)</Trans>,
  done: () => <Trans> (done)</Trans>,
  new: () => <Trans> (new)</Trans>,
};

/**
 * Beside an agent's timestamp while it has unseen notifications: the icon of the highest-priority
 * kind. `botId` seeds the animation so rows do not move in lockstep.
 */
export function StatusMark({ kind, botId }: { kind: NotificationKind; botId: string }) {
  return (
    <span className="inline-flex text-foreground" data-kind={kind}>
      <StatusIcon kind={kind} size={16} seed={botId} />
      <span className="sr-only">{KIND_LABEL[kind]()}</span>
    </span>
  );
}

/** Finance runway as "24 mo"; nothing when unknown. A length of time, so Hide amounts leaves it. */
export const runwayGlance = (months: number | null) =>
  months === null ? undefined : t`${months.toFixed(0)} mo`;

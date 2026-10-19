import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FireTruckIcon } from "@rakazo/ui-web";

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

/** Beside an agent's timestamp while it has an unseen attention notification. */
export function UrgentMark() {
  return (
    <span className="inline-flex text-foreground">
      <FireTruckIcon size={16} />
      <span className="sr-only">
        <Trans> (urgent)</Trans>
      </span>
    </span>
  );
}

/** Finance runway as "24 mo"; nothing when unknown or while amounts are hidden. */
export const runwayGlance = (months: number | null, hidden: boolean) =>
  months === null || hidden ? undefined : t`${months.toFixed(0)} mo`;

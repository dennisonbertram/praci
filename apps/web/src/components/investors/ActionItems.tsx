import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InvestorUpdate } from "@rakazo/contracts";
import { Badge, Button } from "@rakazo/ui-web";
import { shortDay } from "../../lib/finance-format";

/**
 * What needs the founder on the Investors page. Today that is an update draft, which stays here
 * until it is sent or deleted; nothing renders when there is none.
 */
export function ActionItems({
  drafts,
  onOpen,
}: {
  drafts: InvestorUpdate[];
  onOpen: (update: InvestorUpdate) => void;
}) {
  if (drafts.length === 0) return null;
  return (
    <section
      aria-label={t`Action items`}
      className="mb-5 max-w-5xl rounded-xl border border-border"
    >
      <h2 className="px-3.5 pt-3 text-sm font-semibold">
        <Trans>Action items</Trans>
      </h2>
      <ul className="px-1.5 pb-1.5">
        {drafts.map((draft) => (
          <li
            key={draft.id}
            className="flex min-h-11 items-center gap-2 border-t border-border px-2 first:border-t-0"
          >
            <div className="min-w-0 flex-1 py-1.5">
              <span className="block truncate text-sm font-medium" title={draft.subject}>
                {draft.subject}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {t`Drafted ${shortDay(draft.createdAt.slice(0, 10), new Date(), i18n.locale || "en")}`}
              </span>
            </div>
            <Badge variant="secondary">
              <Trans>Draft</Trans>
            </Badge>
            <Button variant="outline" size="sm" onClick={() => onOpen(draft)}>
              <Trans>Open</Trans>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

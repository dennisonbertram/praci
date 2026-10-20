import { useLingui } from "@lingui/react/macro";
import type { InboxPile, InboxPileCounts } from "@rakazo/contracts";
import { Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";

/** Spam shows only when it has mail, or when it is the open pile, so the open tab never vanishes. */
export function InboxPileTabs({
  value,
  counts,
  onChange,
}: {
  /** Undefined while a filter, search or category is open: no tab is selected. */
  value: InboxPile | undefined;
  counts: InboxPileCounts | undefined;
  onChange: (pile: InboxPile) => void;
}) {
  const { t } = useLingui();
  const spam = counts?.spam ?? 0;
  return (
    <Tabs
      className="-mt-2 mb-4"
      value={value ?? null}
      onValueChange={(next) => onChange(next as InboxPile)}
    >
      <TabsList className="max-w-full rounded-full">
        <TabsTrigger value="important" className="rounded-full px-3">
          {t`Important`}
        </TabsTrigger>
        <TabsTrigger value="updates" className="rounded-full px-3">
          {t`Updates`}
        </TabsTrigger>
        <TabsTrigger value="newsletters" className="rounded-full px-3">
          {t`Newsletters`}
        </TabsTrigger>
        {spam > 0 || value === "spam" ? (
          <TabsTrigger value="spam" className="rounded-full px-3">
            {t`Spam`}
            <span className="tabular-nums text-muted-foreground">{spam}</span>
          </TabsTrigger>
        ) : null}
      </TabsList>
    </Tabs>
  );
}

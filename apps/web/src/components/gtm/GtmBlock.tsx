import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { GtmOverview, GtmPageBlock } from "@rakazo/contracts";
import { createContext } from "react";
import { GtmChannels } from "../../pages/gtm/GtmChannels";
import { GtmPlan, isUncertain } from "../../pages/gtm/GtmPlan";

export const GtmBlockContext = createContext<{
  overview: GtmOverview;
  onChange: () => void;
} | null>(null);

export function GtmBlock({
  block,
  overview,
  onChange,
}: {
  block: GtmPageBlock;
  overview: GtmOverview;
  onChange: () => void;
}) {
  if (block.type === "gtm-channels") return <GtmChannels overview={overview} />;
  if (block.type === "gtm-metric") {
    const { label, count, channel, goal } = block.query;
    const n = channel
      ? overview.groups[count].filter((item) => item.channel === channel).length
      : overview.counts[count];
    return (
      <section className="rounded-xl border border-border p-4">
        <h2 className="text-xs text-muted-foreground">{label}</h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {goal === undefined ? (
            n
          ) : (
            <Trans>
              {n} of {goal}
            </Trans>
          )}
        </p>
      </section>
    );
  }
  const { group, channel, category, limit } = block.query;
  const titles = { in_progress: t`In progress`, drafts: t`Drafts for you`, done: t`Done` };
  const items = overview.groups[group]
    .filter(
      (item) =>
        !isUncertain(item) &&
        (!channel || (item.channel != null && channel.includes(item.channel))) &&
        (!category || (item.category != null && category.includes(item.category))),
    )
    .slice(0, limit);
  return <GtmPlan title={titles[group]} items={items} overview={overview} onChange={onChange} />;
}

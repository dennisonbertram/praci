import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { GtmOverview } from "@rakazo/contracts";
import { GTM_CHANNELS } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { useState } from "react";
import { Link } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { publicProof } from "../../pages/gtm/GtmPlan";
import { useFinanceQuery } from "../finance/ui";

function weekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
type Entry = {
  id: string;
  text: string;
  date: Date;
  label: string;
  needsYou: boolean;
  links: { href: string; label: string }[];
};

export function GtmCalendar({
  overview,
  initialDate,
}: {
  overview: GtmOverview;
  initialDate?: Date;
}) {
  const [start, setStart] = useState(() => weekStart(initialDate ?? new Date()));
  const end = addDays(start, 7);
  const from = start.toISOString();
  const to = end.toISOString();
  const queue = useFinanceQuery(
    () => rpc.gtm.queue({ from, to }),
    [from, to, overview.zernioLinked, overview.postingCapability],
  );
  const inWindow = (date: Date) => date >= start && date < end;
  const entries: Entry[] = Object.values(overview.groups)
    .flat()
    .flatMap((item) => {
      if (!item.scheduledFor || item.category === "outbound_email" || item.channel === "email")
        return [];
      const date = new Date(item.scheduledFor);
      if (!inWindow(date)) return [];
      const href = item.status === "done" && item.proof ? publicProof(item.proof) : null;
      return [
        {
          id: `local:${item.id}`,
          text: item.title,
          date,
          label: item.channel ? GTM_CHANNELS[item.channel].label : t`Plan`,
          needsYou: item.status === "parked",
          links: href ? [{ href, label: t`View proof` }] : [],
        },
      ];
    });
  const data = queue.error ? null : queue.data;
  for (const post of data?.posts ?? []) {
    const date = new Date(post.scheduledFor);
    if (!inWindow(date) || !post.platforms.some((platform) => platform.platform !== "email"))
      continue;
    const links = post.platforms.flatMap((target) => {
      const knownAccount = overview.channels.some((channel) =>
        channel.accounts.some(
          (account) => account.id === target.accountId && account.platform === target.platform,
        ),
      );
      const href = target.platformPostUrl && publicProof(target.platformPostUrl);
      return target.platform !== "email" &&
        post.status === "published" &&
        target.status === "published" &&
        knownAccount &&
        href
        ? [{ href, label: target.platform }]
        : [];
    });
    entries.push({
      id: `zernio:${post.id}`,
      text: post.content,
      date,
      label: `Zernio · ${post.status}`,
      needsYou: false,
      links,
    });
  }
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const dayEntries = (day: Date) =>
    entries.filter((entry) => entry.date >= day && entry.date < addDays(day, 1));
  const dateLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const card = (entry: Entry) => (
    <li
      key={entry.id}
      className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3 text-sm"
    >
      <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground">
        <span>{entry.label}</span>
        <time dateTime={entry.date.toISOString()}>
          {entry.date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </time>
      </div>
      <p className="line-clamp-3 break-words">{entry.text}</p>
      {entry.needsYou ? (
        <span className="text-xs text-warning">
          <Trans>Needs you</Trans>
        </span>
      ) : null}
      {entry.links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="block break-words text-xs text-link underline"
        >
          {link.label}
        </a>
      ))}
    </li>
  );

  return (
    <section aria-label={t`Calendar`} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          {dateLabel(start)} – {dateLabel(addDays(start, 6))}
        </h2>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setStart(addDays(start, -7))}>
            <Trans>Previous week</Trans>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStart(weekStart(new Date()))}>
            <Trans>Today</Trans>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStart(addDays(start, 7))}>
            <Trans>Next week</Trans>
          </Button>
          <Button size="sm" variant="ghost" onClick={queue.retry}>
            <Trans>Refresh</Trans>
          </Button>
        </div>
      </div>
      {queue.error || data?.status === "unavailable" ? (
        <p role="status" className="text-sm text-warning">
          <Trans>Zernio queue unavailable</Trans>
        </p>
      ) : !data ? (
        <p role="status" className="text-sm text-muted-foreground">
          <Trans>Loading Zernio queue…</Trans>
        </p>
      ) : data.status === "api_key_required" ? (
        <Link className="text-sm text-link underline" to="/app/integrations?q=Zernio">
          <Trans>API key required for Zernio queue</Trans>
        </Link>
      ) : data.status === "not_connected" ? (
        <p role="status" className="text-sm text-muted-foreground">
          <Trans>Zernio not connected</Trans>
        </p>
      ) : !data.complete ? (
        <p role="status" className="text-sm text-warning">
          <Trans>Zernio queue incomplete</Trans>
        </p>
      ) : null}
      <div
        className="hidden overflow-x-auto rounded-xl border border-border md:block"
        data-testid="gtm-calendar-grid"
      >
        <div className="grid min-w-[56rem] grid-cols-7 divide-x divide-border">
          {days.map((day) => (
            <section key={day.toISOString()} className="min-w-0 p-2">
              <h3 className="mb-3 text-xs font-medium">
                <time dateTime={day.toISOString()}>
                  {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                </time>
              </h3>
              <ul className="space-y-2">{dayEntries(day).map(card)}</ul>
            </section>
          ))}
        </div>
      </div>
      <div className="space-y-4 md:hidden" data-testid="gtm-calendar-agenda">
        {days
          .filter((day) => dayEntries(day).length > 0)
          .map((day) => (
            <section key={day.toISOString()} className="space-y-2">
              <h3 className="text-xs font-medium">
                {day.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </h3>
              <ul className="space-y-2">{dayEntries(day).map(card)}</ul>
            </section>
          ))}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Trans>No scheduled items in this view.</Trans>
        </p>
      ) : null}
    </section>
  );
}

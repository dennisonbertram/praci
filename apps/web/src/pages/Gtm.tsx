import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BotPage } from "@rakazo/contracts";
import { Button, Input, Skeleton, Tabs, TabsList, TabsTrigger } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFinanceQuery } from "../components/finance/ui";
import { PageHeader } from "../components/PageHeader";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { NOTIFICATIONS_CHANGED_EVENT } from "../lib/use-sidebar-glance";
import { errorText } from "../lib/user-error";
import { GtmChannels } from "./gtm/GtmChannels";
import { GtmPlan } from "./gtm/GtmPlan";
import type { PageRemoteUpdate } from "./shell/bot-page-panel";
import { BotPagePanel } from "./shell/bot-page-panel";

export function GtmPage({
  botId,
  remote,
  onAskAgent,
  agentOpen = false,
}: {
  botId?: string;
  remote: PageRemoteUpdate | null;
  onAskAgent?: () => void;
  agentOpen?: boolean;
}) {
  const overview = useFinanceQuery(() => rpc.gtm.overview(), [botId]);
  const [params, setParams] = useSearchParams();
  const calendar = params.get("view") === "calendar";
  const [page, setPage] = useState<BotPage | null>(null);
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const [now, setNow] = useState(Date.now());
  const reload = useRef(overview.reload);
  reload.current = overview.reload;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden") reload.current();
    };
    const timer = setInterval(() => {
      setNow(Date.now());
      refresh();
    }, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const changed = () => {
    overview.reload();
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  };
  const data = overview.data;
  const saveGoal = async () => {
    if (!botId || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (data?.goal) await rpc.scratchpad.update({ itemId: data.goal.id, title: goal });
      else await rpc.scratchpad.create({ botId, title: goal, category: "goal" });
      setEditing(false);
      changed();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const minutes = data?.nextRunAt
    ? Math.max(0, Math.ceil((Date.parse(data.nextRunAt) - now) / 60_000))
    : null;
  return (
    <div className="@container rk-scroll min-w-0 flex-1 overflow-y-auto px-4 pb-8 pt-2 md:px-7 md:pt-5">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title={<Trans>GTM</Trans>}
          meta={
            data ? (
              <>
                <span className={data.counts.needs_you ? "text-warning" : "text-muted-foreground"}>
                  {data.counts.needs_you
                    ? plural(data.counts.needs_you, { one: "# needs you", other: "# need you" })
                    : t`Up to date`}
                </span>
                {minutes !== null ? (
                  <span>
                    · <Trans>Next wakeup in {minutes} min</Trans>
                  </span>
                ) : null}
              </>
            ) : undefined
          }
          actions={
            onAskAgent && !agentOpen ? (
              <Button size="sm" variant="outline" onClick={onAskAgent}>
                <Trans>Ask GTM agent</Trans>
              </Button>
            ) : undefined
          }
        />
        {overview.error ? (
          <div role="alert" className="text-sm text-destructive">
            {overview.error}
            <Button size="sm" variant="ghost" onClick={overview.retry}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : null}
        {!data && !overview.error ? <Skeleton className="h-40 w-full" /> : null}
        {data ? (
          <>
            <section className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-medium text-muted-foreground">
                  <Trans>Goal</Trans>
                </h2>
                {!editing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!botId}
                    onClick={() => {
                      setGoal(data.goal?.title ?? "");
                      setEditing(true);
                    }}
                  >
                    <Trans>Edit</Trans>
                  </Button>
                ) : null}
              </div>
              {editing ? (
                <form
                  className="mt-2 flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveGoal();
                  }}
                >
                  <Input
                    className="min-w-0 flex-1"
                    aria-label={t`Goal`}
                    maxLength={200}
                    required
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                  />
                  <Button size="sm" disabled={busy || !goal.trim()} type="submit">
                    <Trans>Save</Trans>
                  </Button>
                  <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
                    <Trans>Cancel</Trans>
                  </Button>
                </form>
              ) : data.goal ? (
                <p className="break-words text-base font-medium">{data.goal.title}</p>
              ) : (
                <Button className="mt-1" variant="ghost" onClick={onAskAgent}>
                  <Trans>Give the GTM agent a goal</Trans>
                </Button>
              )}
              {error ? (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </section>
            <Tabs
              value={calendar ? "calendar" : "plan"}
              onValueChange={(value) =>
                setParams(value === "calendar" ? { view: "calendar" } : {}, { replace: true })
              }
            >
              <TabsList>
                <TabsTrigger value="plan">
                  <Trans>Plan</Trans>
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <Trans>Calendar</Trans>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {!data.zernioLinked ? (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <h2 className="text-sm font-medium">
                    <Trans>Connect Zernio</Trans>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Trans>Needed to post approved text</Trans>
                  </p>
                </div>
                <Link
                  className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  to="/app/integrations?connect=zernio&returnTo=/app/gtm"
                >
                  <Trans>Connect Zernio</Trans>
                </Link>
              </section>
            ) : null}
            {calendar ? (
              <section aria-label={t`Calendar`} className="rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">
                  <Trans>Calendar view is coming next. Scheduled items remain in Plan.</Trans>
                </p>
              </section>
            ) : (
              <>
                {botId ? (
                  <section className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        <Trans>Written by GTM agent</Trans>
                      </span>
                      {page?.updatedAt ? (
                        <span>
                          <Trans>Updated {formatRelativeTime(page.updatedAt)}</Trans>
                        </span>
                      ) : null}
                    </div>
                    <BotPagePanel
                      key={botId}
                      botId={botId}
                      remote={remote}
                      onPageChange={setPage}
                    />
                  </section>
                ) : null}
                <GtmChannels overview={data} />
                <GtmPlan
                  title={t`Needs you`}
                  items={data.groups.needs_you}
                  overview={data}
                  onChange={changed}
                  empty={t`Up to date`}
                />
                <GtmPlan
                  title={t`In progress`}
                  items={data.groups.in_progress}
                  overview={data}
                  onChange={changed}
                  empty={t`Nothing running`}
                />
                <GtmPlan
                  title={t`Drafts for you`}
                  items={data.groups.drafts}
                  overview={data}
                  onChange={changed}
                  empty={t`No drafts`}
                />
                <GtmPlan
                  title={t`Done`}
                  items={data.groups.done}
                  overview={data}
                  onChange={changed}
                />
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

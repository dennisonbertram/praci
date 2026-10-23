import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CompanyCalendarItem, CompanyFact } from "@rakazo/contracts";
import { companyCalendarMonth, companyHistoryStreams } from "@rakazo/core";
import { Button, Checkbox, Input, Skeleton } from "@rakazo/ui-web";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useFinanceQuery } from "../components/finance/ui";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { todayIso } from "../lib/legal-format";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

export function CompanyCalendar({
  onOpen,
  initialMonth = todayIso().slice(0, 7),
  initialView = "month",
  refreshRevision = 0,
}: {
  onOpen: (fact: CompanyFact) => void;
  initialMonth?: string;
  initialView?: "month" | "agenda";
  refreshRevision?: number;
}) {
  useHideAmounts();
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState(initialView);
  const [anniversaries, setAnniversaries] = useState(false);
  const anniversariesId = useId();
  const [streams, setStreams] = useState<Set<string>>(() => new Set(companyHistoryStreams));
  const [error, setError] = useState("");
  const query = useFinanceQuery(
    () => rpc.company.calendar({ month, anniversaries }),
    [month, anniversaries, refreshRevision],
  );
  useEffect(() => {
    const reload = () => query.reload();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [query.reload]);
  const bounds = companyCalendarMonth(month);
  const items = query.data?.filter((item) => streams.has(item.stream)) ?? [];
  const labels = {
    company: t`Company`,
    people: t`People`,
    funding: t`Funding`,
    legal: t`Legal`,
    product: t`Product`,
    customers: t`Customers`,
  };
  async function open(item: CompanyCalendarItem) {
    if (!item.fact) return;
    try {
      const fact = await rpc.company.fact(item.fact);
      if (fact) {
        setError("");
        onOpen(fact);
      } else {
        setError(t`Fact unavailable`);
        query.reload();
      }
    } catch (cause) {
      setError(errorText(cause));
    }
  }
  const retry = () => {
    setError("");
    query.reload();
  };
  const content = (item: CompanyCalendarItem) => (
    <>
      {maskCurrencyWhenHidden(item.title)}
      {item.anniversary && (
        <span className="block text-xs text-muted-foreground">
          <Trans>Anniversary</Trans>
        </span>
      )}
      {item.status === "suggested" && (
        <span className="block text-xs text-muted-foreground">
          <Trans>Not confirmed</Trans>
        </span>
      )}
    </>
  );
  const entry = (item: CompanyCalendarItem) =>
    item.legalDeadlineId ? (
      <Link
        key={item.id}
        to="/app/legal?view=deadlines"
        className="block break-words py-1 text-start text-sm underline underline-offset-4"
      >
        {content(item)}
      </Link>
    ) : (
      <button
        key={item.id}
        type="button"
        className="block w-full break-words py-1 text-start text-sm underline underline-offset-4"
        onClick={() => void open(item)}
      >
        {content(item)}
      </button>
    );
  return (
    <section aria-label={t`Calendar`} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="month"
          className="w-auto"
          value={month}
          aria-label={t`Month`}
          onChange={(event) => {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value);
          }}
        />
        <Button
          variant={view === "month" ? "secondary" : "ghost"}
          aria-pressed={view === "month"}
          onClick={() => setView("month")}
        >
          <Trans>Month</Trans>
        </Button>
        <Button
          variant={view === "agenda" ? "secondary" : "ghost"}
          aria-pressed={view === "agenda"}
          onClick={() => setView("agenda")}
        >
          <Trans>Agenda</Trans>
        </Button>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id={anniversariesId}
            checked={anniversaries}
            onCheckedChange={(checked) => setAnniversaries(checked === true)}
          />
          <label htmlFor={anniversariesId}>
            <Trans>Anniversaries</Trans>
          </label>
        </div>
      </div>
      <fieldset className="flex flex-wrap gap-1 border-0 p-0">
        <legend className="sr-only">
          <Trans>Streams</Trans>
        </legend>
        {companyHistoryStreams.map((stream) => (
          <Button
            key={stream}
            variant={streams.has(stream) ? "secondary" : "ghost"}
            aria-pressed={streams.has(stream)}
            onClick={() =>
              setStreams((current) => {
                const next = new Set(current);
                if (next.has(stream)) next.delete(stream);
                else next.add(stream);
                return next;
              })
            }
          >
            {labels[stream]}
          </Button>
        ))}
      </fieldset>
      {(query.error || error) && (
        <p role="alert" className="text-destructive">
          {query.error || error}
          <Button variant="link" onClick={retry}>
            <Trans>Retry</Trans>
          </Button>
        </p>
      )}
      {!query.data && !query.error && <Skeleton className="h-64 w-full" />}
      {query.data &&
        (view === "agenda" ? (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-4 py-3">
                <time dateTime={item.date} className="shrink-0 text-sm text-muted-foreground">
                  {item.date}
                </time>
                <div>{entry(item)}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-140 table-fixed border-collapse" aria-label={month}>
              <thead>
                <tr>
                  {Array.from({ length: 7 }, (_, day) => (
                    <th
                      key={day}
                      scope="col"
                      className="p-2 text-start text-xs font-normal text-muted-foreground"
                    >
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: "short",
                        timeZone: "UTC",
                      }).format(new Date(Date.UTC(2024, 0, 7 + day)))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil((bounds.offset + bounds.days) / 7) }, (_, week) => (
                  <tr key={week}>
                    {Array.from({ length: 7 }, (_, weekday) => {
                      const day = week * 7 + weekday - bounds.offset + 1;
                      const date = `${month}-${String(day).padStart(2, "0")}`;
                      return (
                        <td key={weekday} className="h-24 border p-2 align-top">
                          {day > 0 && day <= bounds.days && (
                            <>
                              <time dateTime={date} className="text-xs text-muted-foreground">
                                {day}
                              </time>
                              {items.filter((item) => item.date === date).map(entry)}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {query.data && !items.length && (
        <p className="text-sm text-muted-foreground">
          <Trans>No dates</Trans>
        </p>
      )}
    </section>
  );
}

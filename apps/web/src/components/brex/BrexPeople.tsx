import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BrexPerson } from "@rakazo/contracts";
import { newClientId } from "@rakazo/core";
import {
  Button,
  ContactAvatar,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { money } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { sortBy, useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { Section, useFinanceQuery } from "../finance/ui";
import { SearchField, SortControl } from "../ListControls";
import { BrexErrorNotice } from "./BrexSection";
import { offboardMessage, offboardPlan } from "./brex-utils";

type PeopleSort = "name" | "cards" | "limits" | "spend";
const PEOPLE_SORTS: readonly PeopleSort[] = ["name", "cards", "limits", "spend"];
const DEFAULT_PEOPLE_SORT = { field: "name", dir: "asc" } as const;

const sortValue = (person: BrexPerson, field: PeopleSort): string | number | null => {
  switch (field) {
    case "name":
      return person.name;
    case "cards":
      return person.activeCardCount;
    case "limits":
      return person.spendLimitIds.length;
    case "spend":
      return person.monthSpendCents;
  }
};

const hasOffboardWork = (person: BrexPerson) => {
  const plan = offboardPlan(person);
  return plan.lockCardIds.length + plan.cancelCardIds.length + plan.spendLimitIds.length > 0;
};

function OffboardDialog({
  person,
  busy,
  error,
  onClose,
  onSend,
}: {
  person: BrexPerson;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSend: () => void;
}) {
  const plan = offboardPlan(person);
  const cardNames = new Map(person.cards.map((card) => [card.cardId, card.name]));
  const limitNames = new Map(
    person.spendLimitIds.map((id, index) => [id, person.spendLimitNames[index] ?? id]),
  );
  const names = (ids: string[], lookup: Map<string, string>) =>
    ids.map((id) => lookup.get(id) ?? id).join(", ");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Offboard {person.name}</Trans>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          {plan.lockCardIds.length > 0 ? (
            <div>
              <p className="font-medium">
                {plural(plan.lockCardIds.length, {
                  one: "Lock # card",
                  other: "Lock # cards",
                })}
              </p>
              <p className="text-xs text-muted-foreground">{names(plan.lockCardIds, cardNames)}</p>
            </div>
          ) : null}
          {plan.cancelCardIds.length > 0 ? (
            <div>
              <p className="font-medium">
                {plural(plan.cancelCardIds.length, {
                  one: "Cancel # card",
                  other: "Cancel # cards",
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {names(plan.cancelCardIds, cardNames)}
              </p>
            </div>
          ) : null}
          {plan.spendLimitIds.length > 0 ? (
            <div>
              <p className="font-medium">
                {plural(plan.spendLimitIds.length, {
                  one: "Remove from # spend limit",
                  other: "Remove from # spend limits",
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {names(plan.spendLimitIds, limitNames)}
              </p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="button" onClick={onSend} disabled={busy}>
            {busy ? <Trans>Sending…</Trans> : <Trans>Request offboarding</Trans>}
          </Button>
        </DialogFooter>
        <p className="text-xs text-muted-foreground">
          <Trans>Every change waits for your approval.</Trans>
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function BrexPeople() {
  const navigate = useNavigate();
  useHideAmounts();
  const query = useFinanceQuery(() => rpc.brexCards.people(), []);
  const data = query.data;
  const list = useListParams(PEOPLE_SORTS, DEFAULT_PEOPLE_SORT);
  const search = list.param("q");
  const [pending, setPending] = useState<BrexPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const botId = data?.agentBotId ?? null;
  const enabled = Boolean(data?.writesEnabled && botId);

  useEffect(() => {
    if (!enabled) setPending(null);
  }, [enabled]);

  const rows = useMemo(() => {
    const q = search?.trim().toLowerCase();
    const filtered = (data?.people ?? []).filter((person) => {
      if (!q) return true;
      return `${person.name} ${person.email ?? ""}`.toLowerCase().includes(q);
    });
    return sortBy(filtered, (person) => sortValue(person, list.sort.field), list.sort.dir);
  }, [data, search, list.sort.field, list.sort.dir]);
  const sortNames: Record<PeopleSort, string> = {
    name: t`Person`,
    cards: t`Cards`,
    limits: t`Limits`,
    spend: t`Spend this month`,
  };

  async function send(person: BrexPerson) {
    if (!botId || !enabled || busy || !hasOffboardWork(person)) return;
    setBusy(true);
    setSendError("");
    try {
      await rpc.threads.send({
        botId,
        clientNonce: newClientId(),
        text: offboardMessage(person),
      });
      setPending(null);
      navigate(`/app/${botId}`);
    } catch (cause) {
      setSendError(errorText(cause));
      setBusy(false);
    }
  }

  if (query.error) return <BrexErrorNotice query={query} />;
  if (!data) {
    return (
      <div role="status" aria-label={t`Loading`}>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.partial ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Partial results</Trans>
        </p>
      ) : null}
      <Section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SearchField
            name="brex-people-search"
            value={list.param("q") ?? ""}
            onChange={(value) => list.setParam("q", value || undefined)}
            placeholder={t`Search people`}
            label={t`Search people`}
            className="w-56"
          />
          <span className="ms-auto flex items-center gap-1 @2xl:hidden">
            <SortControl
              fields={PEOPLE_SORTS.map(
                (field) => [field, sortNames[field]] as [PeopleSort, string],
              )}
              field={list.sort.field}
              fieldLabel={sortNames[list.sort.field]}
              direction={list.sort.dir}
              onField={(field) => list.setSort({ field, dir: "asc" })}
              onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
            />
          </span>
          {list.param("q") ? (
            <Button variant="ghost" size="sm" onClick={() => list.clear("q")}>
              <Trans>Clear filters</Trans>
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <Table compact>
            <TableHeader>
              <TableHeadRow>
                <TableHead
                  sortDirection={list.sort.field === "name" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("name")}
                >
                  <Trans>Person</Trans>
                </TableHead>
                <TableHead
                  className="hidden @lg:table-cell"
                  sortDirection={list.sort.field === "cards" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("cards")}
                >
                  <Trans>Cards</Trans>
                </TableHead>
                <TableHead
                  className="hidden @lg:table-cell"
                  sortDirection={list.sort.field === "limits" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("limits")}
                >
                  <Trans>Limits</Trans>
                </TableHead>
                <TableHead
                  className="text-end"
                  sortDirection={list.sort.field === "spend" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("spend")}
                >
                  <Trans>Spend this month</Trans>
                </TableHead>
                <TableHead />
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-3 text-muted-foreground">
                    {list.param("q") ? <Trans>No matches</Trans> : <Trans>No people</Trans>}
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((person) => (
                <TableRow key={person.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <ContactAvatar name={person.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{person.name}</span>
                        {person.email ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {person.email}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground @lg:table-cell">
                    {person.cards.length === 0
                      ? "—"
                      : [
                          person.activeCardCount > 0
                            ? plural(person.activeCardCount, {
                                one: "# active card",
                                other: "# active cards",
                              })
                            : null,
                          person.terminatedCardCount > 0
                            ? plural(person.terminatedCardCount, {
                                one: "# terminated",
                                other: "# terminated",
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground @lg:table-cell">
                    {person.spendLimitNames.length > 0 ? person.spendLimitNames.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {money(person.monthSpendCents)}
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!enabled || busy || !hasOffboardWork(person)}
                      onClick={() => {
                        setSendError("");
                        setPending(person);
                      }}
                    >
                      <Trans>Offboard</Trans>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
      {pending ? (
        <OffboardDialog
          person={pending}
          busy={busy}
          error={sendError}
          onClose={() => {
            if (!busy) {
              setPending(null);
              setSendError("");
            }
          }}
          onSend={() => void send(pending)}
        />
      ) : null}
    </div>
  );
}

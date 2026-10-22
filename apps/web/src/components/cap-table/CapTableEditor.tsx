import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CapTableSnapshot, CapTableSnapshotInput } from "@rakazo/contracts";
import { NATIVE_SECURITIES } from "@rakazo/contracts";
import { capTableMath, isSafeSecurity } from "@rakazo/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  Skeleton,
  Textarea,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MASK, percentFigure, totalPercent } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { OwnershipPlaceholder } from "../investors/Placeholders";
import { OwnershipBar } from "./OwnershipBar";

/** One typed row. Numbers stay text while they are typed; blank means unknown. */
type Draft = {
  id: string;
  name: string;
  security: string;
  shares: string;
  invested: string;
  email: string | null;
  organization: string | null;
};

type Status = "idle" | "saving" | "saved" | "failed";

/** The new version when the server took the table, or the table as it now is when it changed since this copy was loaded. */
export type SaveResult = { updatedAt: string } | { conflict: CapTableSnapshot };

let counter = 0;
const newId = () => `row-${Date.now().toString(36)}-${++counter}`;
const blank = (): Draft => ({
  id: newId(),
  name: "",
  security: "Common",
  shares: "",
  invested: "",
  email: null,
  organization: null,
});

// The fields are parsed in this one format, so saved numbers are shown in it whatever the UI language.
const editFormat = "en-US";
const draftsOf = (snapshot: CapTableSnapshot): Draft[] => [
  ...snapshot.holders.map((holder, i) => ({
    id: holder.id ?? `saved-${i}`,
    name: holder.name,
    security: holder.security,
    shares: holder.shares == null ? "" : holder.shares.toLocaleString(editFormat),
    invested: holder.amountUsd == null ? "" : `$${holder.amountUsd.toLocaleString(editFormat)}`,
    email: holder.email,
    organization: holder.organization,
  })),
  blank(),
];
const poolOf = (snapshot: CapTableSnapshot) =>
  snapshot.optionPoolAvailable == null
    ? ""
    : snapshot.optionPoolAvailable.toLocaleString(editFormat);

/** Whole shares: digits and thousands separators. Null is blank; undefined is not a number. */
const parseShares = (text: string): number | null | undefined => {
  const value = text.trim();
  if (!value) return null;
  return /^\d[\d,]*$/.test(value) ? Number(value.replaceAll(",", "")) : undefined;
};
/** Dollars, with an optional $ and commas; a negative value is not accepted. */
const parseUsd = (text: string): number | null | undefined => {
  const value = text.trim().replace(/^\$/, "");
  if (!value) return null;
  return /^\d[\d,]*(\.\d+)?$/.test(value) ? Number(value.replaceAll(",", "")) : undefined;
};

const isBlankRow = (row: Draft) => !row.name.trim() && !row.shares.trim() && !row.invested.trim();
const rowProblems = (row: Draft) => ({
  name: !row.name.trim() && !isBlankRow(row),
  shares: parseShares(row.shares) === undefined,
  invested: parseUsd(row.invested) === undefined,
});

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The typed-in cap table: always editable, saved on blur as the whole table with the version it
 * was loaded from. A failed save keeps the typed rows ("Not saved", Retry); a table that changed
 * elsewhere reloads ("Changed elsewhere"). The percent column and the bar come from `capTableMath`.
 */
export function CapTableEditor({
  snapshot,
  onSave,
  contactIdFor,
  onAddContact,
  onOpenContact,
  statusSlot = null,
}: {
  snapshot: CapTableSnapshot;
  onSave: (table: CapTableSnapshotInput, loadedAt: string) => Promise<SaveResult>;
  /** The id of the contact with this holder name, if any. */
  contactIdFor: (name: string) => string | null;
  onAddContact: (name: string) => void;
  onOpenContact: (contactId: string) => void;
  /** Where "Saved" and "Not saved" show, e.g. the card header; inline above the table when absent. */
  statusSlot?: HTMLElement | null;
}) {
  const hidden = useHideAmounts();
  const [rows, setRows] = useState<Draft[]>(() => draftsOf(snapshot));
  const [pool, setPool] = useState(() => poolOf(snapshot));
  const [status, setStatus] = useState<Status>("idle");
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const [checked, setChecked] = useState(false);

  // The latest typed state and the version it builds on, for the save that runs after a blur.
  const latest = useRef({ rows, pool });
  latest.current = { rows, pool };
  const version = useRef(snapshot.updatedAt);
  // Typed changes not yet accepted by the server.
  const pending = useRef(false);
  const inflight = useRef(false);
  const again = useRef(false);

  // A change from outside (another tab, the agent) replaces the rows unless the founder is mid-edit.
  useEffect(() => {
    if (snapshot.updatedAt === version.current || pending.current || inflight.current) return;
    version.current = snapshot.updatedAt;
    setRows(draftsOf(snapshot));
    setPool(poolOf(snapshot));
  }, [snapshot]);

  const parsed = useMemo(
    () =>
      rows
        .filter((row) => !isBlankRow(row))
        .map((row) => ({
          row,
          shares: parseShares(row.shares) ?? null,
          amountUsd: parseUsd(row.invested) ?? null,
        })),
    [rows],
  );
  const poolShares = parseShares(pool) ?? null;
  const math = capTableMath({
    fullyDilutedShares: parsed.reduce(
      (sum, { row, shares }) => sum + (isSafeSecurity(row.security) ? 0 : (shares ?? 0)),
      poolShares ?? 0,
    ),
    optionPoolAvailable: poolShares,
    holders: parsed.map(({ row, shares, amountUsd }) => ({
      security: row.security,
      shares,
      amountUsd,
    })),
  });
  const percentOf = new Map(parsed.map(({ row }, i) => [row.id, math.holders[i]?.percent ?? null]));

  const securities = [
    ...new Set([
      ...NATIVE_SECURITIES,
      ...rows.map((row) => row.security),
      ...snapshot.holders.map((holder) => holder.security),
    ]),
  ];

  async function save(force = false) {
    if (!pending.current && !force) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    const { rows: current, pool: currentPool } = latest.current;
    const filled = current.filter((row) => !isBlankRow(row));
    const invalid =
      filled.some((row) => Object.values(rowProblems(row)).some(Boolean)) ||
      parseShares(currentPool) === undefined;
    setChecked(true);
    if (invalid) {
      setStatus("failed");
      return;
    }
    const holders = filled.map((row) => ({
      id: row.id,
      name: row.name.trim(),
      email: row.email,
      organization: row.organization,
      security: row.security,
      shares: parseShares(row.shares) ?? null,
      amountUsd: parseUsd(row.invested) ?? null,
      percent: null,
    }));
    const poolCount = parseShares(currentPool) ?? null;
    const total = holders.reduce(
      (sum, h) => sum + (isSafeSecurity(h.security) ? 0 : (h.shares ?? 0)),
      poolCount ?? 0,
    );
    const shareClasses = capTableMath({
      fullyDilutedShares: total,
      optionPoolAvailable: poolCount,
      holders,
    }).classes;
    inflight.current = true;
    pending.current = false;
    setStatus("saving");
    try {
      const result = await onSave(
        {
          companyName: snapshot.companyName,
          asOf: today(),
          source: "native",
          sourceRef: null,
          fullyDilutedShares: total,
          amountRaisedUsd: null,
          optionPoolAvailable: poolCount,
          latest409a: snapshot.latest409a,
          shareClasses,
          holders,
        },
        version.current,
      );
      if ("conflict" in result) {
        // Someone else changed the table: show theirs, and say so.
        again.current = false;
        version.current = result.conflict.updatedAt;
        setRows(draftsOf(result.conflict));
        setPool(poolOf(result.conflict));
        setChangedElsewhere(true);
        setStatus("idle");
      } else {
        version.current = result.updatedAt;
        setChangedElsewhere(false);
        setStatus("saved");
      }
    } catch {
      pending.current = true;
      setStatus("failed");
    } finally {
      inflight.current = false;
      if (again.current) {
        again.current = false;
        void save();
      }
    }
  }

  const edit = (id: string, patch: Partial<Draft>) => {
    pending.current = true;
    setStatus((current) => (current === "saved" ? "idle" : current));
    setRows((current) => {
      const next = current.map((row) => (row.id === id ? { ...row, ...patch } : row));
      const last = next[next.length - 1];
      return last && !isBlankRow(last) ? [...next, blank()] : next;
    });
  };
  const remove = (id: string) => {
    pending.current = true;
    setRows((current) => current.filter((row) => row.id !== id));
    // The state update lands before the save reads it.
    queueMicrotask(() => void save());
  };

  const field = "h-8 text-sm pointer-coarse:h-11";
  const label = "text-xs text-muted-foreground @lg:sr-only";
  // Nothing typed yet: the bar and the rows beneath the Add holder row are static skeletons.
  const empty = parsed.length === 0 && poolShares == null;
  const columns = "@lg:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem_4.5rem_2rem]";
  const statusLine = (
    <>
      {status === "failed" ? (
        <>
          <span className="text-destructive">
            <Trans>Not saved</Trans>
          </span>
          <Button size="sm" variant="outline" onClick={() => void save(true)}>
            <Trans>Retry</Trans>
          </Button>
        </>
      ) : status === "saved" ? (
        <span className="text-muted-foreground">
          <Trans>Saved</Trans>
        </span>
      ) : null}
      {changedElsewhere ? (
        <span className="text-destructive">
          <Trans>Changed elsewhere</Trans>
        </span>
      ) : null}
    </>
  );
  return (
    <div>
      {statusSlot ? (
        createPortal(statusLine, statusSlot)
      ) : (
        <div className="flex min-h-8 items-center justify-end gap-2 text-xs">{statusLine}</div>
      )}
      {empty ? (
        <OwnershipPlaceholder className="mb-3" />
      ) : (
        <OwnershipBar className="mb-3" classes={math.classes} pool={math.pool?.percent ?? null} />
      )}
      <div
        className={`hidden gap-2 px-1 pb-1 text-xs font-medium text-muted-foreground @lg:grid ${columns}`}
        aria-hidden="true"
      >
        <span>
          <Trans>Holder</Trans>
        </span>
        <span>
          <Trans>Security</Trans>
        </span>
        <span>
          <Trans>Shares</Trans>
        </span>
        <span>
          <Trans>Invested</Trans>
        </span>
        <span className="text-end">
          <Trans>Fully diluted</Trans>
        </span>
        <span />
      </div>
      <ul className="flex flex-col gap-3 @lg:gap-1.5">
        {rows.map((row, index) => {
          const problems = checked
            ? rowProblems(row)
            : { name: false, shares: false, invested: false };
          const contactId = row.name.trim() ? contactIdFor(row.name.trim()) : null;
          const isLastBlank = index === rows.length - 1 && isBlankRow(row);
          return (
            <li
              key={row.id}
              data-testid="holder-row"
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1.5 @lg:items-center ${columns}`}
            >
              <div className="min-w-0 @lg:col-start-1">
                <label className={label} htmlFor={`${row.id}-name`}>
                  <Trans>Holder</Trans>
                </label>
                <Textarea
                  id={`${row.id}-name`}
                  rows={1}
                  className={`${field} min-h-8 resize-none py-1 field-sizing-content`}
                  placeholder={isLastBlank ? t`Add holder` : undefined}
                  value={row.name}
                  aria-invalid={problems.name || undefined}
                  onChange={(e) => edit(row.id, { name: e.target.value })}
                  onBlur={() => void save()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </div>
              <div className="col-span-2 min-w-0 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1">
                <label className={label} htmlFor={`${row.id}-security`}>
                  <Trans>Security</Trans>
                </label>
                <NativeSelect
                  id={`${row.id}-security`}
                  className="w-full"
                  value={row.security}
                  onChange={(e) => {
                    edit(row.id, { security: e.target.value });
                    queueMicrotask(() => void save());
                  }}
                >
                  {[...new Set([...securities, row.security])].map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="col-span-2 min-w-0 @lg:col-span-1 @lg:col-start-3 @lg:row-start-1">
                <label className={label} htmlFor={`${row.id}-shares`}>
                  <Trans>Shares</Trans>
                </label>
                <Input
                  id={`${row.id}-shares`}
                  inputMode="numeric"
                  className={`${field} text-end tabular-nums`}
                  placeholder={isLastBlank ? t`Shares` : undefined}
                  value={row.shares}
                  aria-invalid={problems.shares || undefined}
                  onChange={(e) => edit(row.id, { shares: e.target.value })}
                  onBlur={() => void save()}
                />
              </div>
              <div className="col-span-2 min-w-0 @lg:col-span-1 @lg:col-start-4 @lg:row-start-1">
                <label className={label} htmlFor={`${row.id}-invested`}>
                  <Trans>Invested</Trans>
                </label>
                <Input
                  id={`${row.id}-invested`}
                  inputMode="decimal"
                  className={`${field} text-end tabular-nums`}
                  placeholder={isLastBlank ? t`Invested` : undefined}
                  // While amounts are hidden the figure is masked and cannot be edited.
                  value={hidden && row.invested ? `$${MASK}` : row.invested}
                  readOnly={hidden && !!row.invested}
                  aria-invalid={problems.invested || undefined}
                  onChange={(e) => edit(row.id, { invested: e.target.value })}
                  onBlur={() => void save()}
                />
              </div>
              <span className="row-start-1 self-center text-end text-sm tabular-nums text-muted-foreground @lg:col-start-5 @lg:row-start-1">
                {isBlankRow(row) ? "" : percentFigure(percentOf.get(row.id) ?? null, 1)}
              </span>
              <div className="row-start-1 self-center @lg:col-start-6">
                {isBlankRow(row) ? null : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t`Actions for ${row.name || t`holder`}`}
                        />
                      }
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {contactId ? (
                        <DropdownMenuItem onClick={() => onOpenContact(contactId)}>
                          <Trans>Open contact</Trans>
                        </DropdownMenuItem>
                      ) : row.name.trim() ? (
                        <DropdownMenuItem onClick={() => onAddContact(row.name.trim())}>
                          <Trans>Add as contact</Trans>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem variant="destructive" onClick={() => remove(row.id)}>
                        <Trans>Delete holder</Trans>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          );
        })}
        {empty
          ? [0, 1].map((n) => (
              <li
                key={`placeholder-${n}`}
                aria-hidden="true"
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 py-2 ${columns}`}
              >
                <Skeleton static className="h-2.5 w-2/5 @lg:col-start-1" />
                <Skeleton static className="hidden h-2.5 w-14 @lg:col-start-2 @lg:block" />
                <Skeleton
                  static
                  className="hidden h-2.5 w-3/4 justify-self-end @lg:col-start-3 @lg:block"
                />
                <Skeleton
                  static
                  className="hidden h-2.5 w-3/5 justify-self-end @lg:col-start-4 @lg:block"
                />
                <Skeleton static className="h-2.5 w-11 justify-self-end @lg:col-start-5" />
              </li>
            ))
          : null}
        <li
          className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 ${columns}`}
        >
          <span className="text-sm text-muted-foreground @lg:col-start-1">
            <Trans>Unallocated pool</Trans>
          </span>
          <span className="hidden text-sm text-muted-foreground @lg:col-start-2 @lg:row-start-1 @lg:block">
            <Trans>Pool</Trans>
          </span>
          <div className="col-span-2 min-w-0 @lg:col-span-1 @lg:col-start-3 @lg:row-start-1">
            <label className={label} htmlFor="pool-shares">
              <Trans>Pool shares</Trans>
            </label>
            <Input
              id="pool-shares"
              inputMode="numeric"
              className={`${field} text-end tabular-nums`}
              value={pool}
              placeholder="—"
              aria-invalid={(checked && parseShares(pool) === undefined) || undefined}
              onChange={(e) => {
                pending.current = true;
                setPool(e.target.value);
              }}
              onBlur={() => void save()}
            />
          </div>
          {empty ? (
            <Skeleton
              static
              aria-hidden="true"
              className="row-start-1 h-2.5 w-11 justify-self-end @lg:col-start-5"
            />
          ) : (
            <span className="row-start-1 self-center text-end text-sm tabular-nums text-muted-foreground @lg:col-start-5">
              {percentFigure(math.pool?.percent ?? null, 1)}
            </span>
          )}
        </li>
        {empty ? null : (
          <li
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-sm font-medium ${columns}`}
          >
            <span className="@lg:col-start-1">
              <Trans>Total</Trans>
            </span>
            <span className="text-end tabular-nums @lg:col-start-5">
              {percentFigure(
                totalPercent([math.pool?.percent, ...math.holders.map((h) => h.percent)]),
                1,
              )}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

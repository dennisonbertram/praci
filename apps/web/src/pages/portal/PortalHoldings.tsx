import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { EquityAccessHolding, EquityAccessLevel, EquityAccessView } from "@rakazo/contracts";
import { EQUITY_ACCESS_LEVELS } from "@rakazo/contracts";
import {
  Button,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useState } from "react";
import { levelLabel } from "../../components/cap-table/access/access-levels";
import { formatDay } from "../../components/cap-table/options/format";
import { formatCents } from "../../components/cap-table/securities/format";
import { formatPrice } from "../../components/cap-table/views/format";
import { requestPortalAccess } from "../../lib/portal";

const locale = () => i18n.locale || "en";
const shares = (value: string) => new Intl.NumberFormat(locale()).format(BigInt(value));
const amount = (row: EquityAccessHolding) =>
  row.quantity != null
    ? shares(row.quantity)
    : row.principalCents != null
      ? formatCents(row.principalCents)
      : "—";

function HoldingRows({ rows }: { rows: EquityAccessHolding[] }) {
  return (
    <Table>
      <TableHeader>
        <TableHeadRow>
          <TableHead>{t`Security`}</TableHead>
          <TableHead>{t`Class`}</TableHead>
          <TableHead className="text-end">{t`Amount`}</TableHead>
          <TableHead>{t`Issued`}</TableHead>
        </TableHeadRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.kind}-${row.label}-${index}`}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell>{row.shareClassName ?? "—"}</TableCell>
            <TableCell className="text-end tabular-nums">{amount(row)}</TableCell>
            <TableCell className="tabular-nums">
              {row.issueDate ? formatDay(row.issueDate) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Levels above the holder's own, most first. */
const higher = (level: EquityAccessLevel) =>
  EQUITY_ACCESS_LEVELS.slice(0, EQUITY_ACCESS_LEVELS.indexOf(level)).filter((l) => l !== "none");

/** The holder's cap table in the portal: exactly the sections their access level returns. */
export function PortalHoldings({
  view,
  preview = false,
}: {
  view: EquityAccessView;
  /** The admin's preview: the same sections, without the holder's request control. */
  preview?: boolean;
}) {
  const options = preview ? [] : higher(view.level);
  const [ask, setAsk] = useState<EquityAccessLevel | "">("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  if (view.level === "none" || !view.personal) return null;
  // The holder's own rows are already under "Your holdings".
  const own = view.personal.stakeholderId;
  const others = (view.holders ?? []).filter((holder) => holder.stakeholderId !== own);
  const send = async () => {
    if (!ask) return;
    setState("sending");
    try {
      await requestPortalAccess(ask);
      setState("sent");
    } catch {
      setState("failed");
    }
  };
  return (
    <>
      {view.requestedLevel && !preview ? (
        <p className="text-sm text-muted-foreground">
          {t`Requested ${levelLabel(view.requestedLevel)} access`}
        </p>
      ) : options.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label={t`Request access`}
            value={ask}
            onChange={(event) => setAsk(event.target.value as EquityAccessLevel | "")}
          >
            <NativeSelectOption value="">{t`Request more access`}</NativeSelectOption>
            {options.map((level) => (
              <NativeSelectOption key={level} value={level}>
                {levelLabel(level)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            className="min-h-11 md:min-h-8"
            disabled={!ask || state === "sending" || state === "sent"}
            onClick={() => void send()}
          >
            {state === "sent" ? t`Requested` : t`Request`}
          </Button>
          {state === "failed" ? (
            <p role="alert" className="text-sm text-destructive">
              {t`Could not send the request`}
            </p>
          ) : null}
        </div>
      ) : null}
      <section aria-label={t`Your holdings`} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t`Your holdings`}</h2>
        {view.personal.holdings.length > 0 ? (
          <HoldingRows rows={view.personal.holdings} />
        ) : (
          <p className="text-sm text-muted-foreground">{t`No holdings`}</p>
        )}
        {view.estimatedValue ? (
          <p className="text-sm">
            {t`Estimated value ${formatCents(view.estimatedValue.valueCents)}`}
            <span className="text-muted-foreground">
              {" "}
              {t`at ${formatPrice(view.estimatedValue.pricePerShare)} per share, ${formatDay(view.estimatedValue.effectiveDate)}`}
            </span>
          </p>
        ) : null}
      </section>
      {view.summary ? (
        <section aria-label={t`Cap table`} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t`Cap table`}</h2>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Class`}</TableHead>
                <TableHead className="text-end">{t`Outstanding`}</TableHead>
                <TableHead className="text-end">{t`Fully diluted`}</TableHead>
                <TableHead className="text-end">{t`Fully diluted %`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {view.summary.classes.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {shares(row.outstandingShares)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {shares(row.fullyDilutedShares)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {Number(row.fullyDilutedPercent).toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
      {view.shareClasses?.length ? (
        <section aria-label={t`Share classes`} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t`Share classes`}</h2>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Class`}</TableHead>
                <TableHead className="text-end">{t`Issue price`}</TableHead>
                <TableHead className="text-end">{t`Liquidation`}</TableHead>
                <TableHead className="text-end">{t`Seniority`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {view.shareClasses.map((row) => (
                <TableRow key={row.prefix}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.originalIssuePrice ? formatPrice(row.originalIssuePrice) : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{`${row.liquidationMultiple}×`}</TableCell>
                  <TableCell className="text-end tabular-nums">{row.seniority}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
      {view.fundraising?.length ? (
        <section aria-label={t`Fundraising`} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t`Fundraising`}</h2>
          <ul className="text-sm">
            {view.fundraising.map((row) => (
              <li key={row.name} className="flex justify-between gap-3 border-b border-border py-2">
                <span className="font-medium">{row.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.closingDate ? formatDay(row.closingDate) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {others.length ? (
        <section aria-label={t`Holders`} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t`Holders`}</h2>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Holder`}</TableHead>
                <TableHead>{t`Security`}</TableHead>
                <TableHead>{t`Class`}</TableHead>
                <TableHead className="text-end">{t`Amount`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {others.flatMap((holder) =>
                holder.holdings.map((row, index) => (
                  <TableRow key={`${holder.stakeholderId}-${row.kind}-${row.label}`}>
                    <TableCell className="font-medium">{index === 0 ? holder.name : ""}</TableCell>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{row.shareClassName ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{amount(row)}</TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </>
  );
}

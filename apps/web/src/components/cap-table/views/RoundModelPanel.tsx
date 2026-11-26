import { t } from "@lingui/core/macro";
import type { EquityConvertible, EquityRoundModel, EquityRoundScenario } from "@rakazo/contracts";
import { toCsv } from "@rakazo/core/equity";
import {
  Button,
  Checkbox,
  enqueueNotificationToast,
  Field,
  FieldLabel,
  Input,
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
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { downloadText } from "./download";
import { formatDollars, formatPercent, formatShares } from "./format";
import { centsToDollars, dollarsToCents } from "./money";

type Investment = { name: string; amount: string };

/** A pro forma cap table for a new priced round. Scenarios are saved; the ledger never changes. */
export function RoundModelPanel() {
  const [scenarios, setScenarios] = useState<EquityRoundScenario[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [name, setName] = useState("");
  const [preMoney, setPreMoney] = useState("");
  const [pool, setPool] = useState("");
  const [investments, setInvestments] = useState<Investment[]>([{ name: "", amount: "" }]);
  const [model, setModel] = useState<EquityRoundModel | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [convertibles, setConvertibles] = useState<EquityConvertible[]>([]);
  /** Excluded convertible ids; every outstanding one converts unless unticked. */
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [pickConvertibles, setPickConvertibles] = useState(false);

  useEffect(() => {
    rpc.equity.views.scenarios
      .list({ pageSize: 100 })
      .then((page: { items: EquityRoundScenario[] }) => setScenarios(page.items))
      .catch(() => setScenarios([]));
    rpc.equity.convertibles
      .list({ pageSize: 500, status: ["outstanding"] })
      .then((page: { items: EquityConvertible[] }) => setConvertibles(page.items))
      .catch(() => setConvertibles([]));
  }, []);

  const load = (id: string) => {
    setScenarioId(id);
    const scenario = scenarios.find((row) => row.id === id);
    if (!scenario) {
      // New scenario: start from an empty form, not the last scenario's numbers.
      setName("");
      setPreMoney("");
      setPool("");
      setInvestments([{ name: "", amount: "" }]);
      setExcluded(new Set());
      setModel(null);
      return;
    }
    setName(scenario.name);
    setPreMoney(centsToDollars(scenario.preMoneyValuationCents));
    setPool(scenario.targetPoolPercent ?? "");
    setInvestments(
      scenario.investments.map((row) => ({
        name: row.name,
        amount: centsToDollars(row.amountCents),
      })),
    );
    setExcluded(
      new Set(
        scenario.convertibleIds
          ? convertibles.map((row) => row.id).filter((id) => !scenario.convertibleIds?.includes(id))
          : [],
      ),
    );
    setModel(null);
  };

  const terms = () => {
    const preMoneyValuationCents = dollarsToCents(preMoney);
    const rows = investments.filter((row) => row.name.trim() || row.amount.trim());
    const parsed = rows.map((row) => ({
      name: row.name.trim(),
      amountCents: dollarsToCents(row.amount),
    }));
    if (!preMoneyValuationCents || parsed.some((row) => !row.name || row.amountCents == null)) {
      setError(t`Enter a pre-money valuation and a name and amount for each investor`);
      return null;
    }
    return {
      preMoneyValuationCents,
      targetPoolPercent: pool.trim() || null,
      convertibleIds:
        excluded.size === 0
          ? null
          : convertibles.map((row) => row.id).filter((id) => !excluded.has(id)),
      investments: parsed as { name: string; amountCents: string }[],
    };
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  const modelIt = () => {
    const input = terms();
    if (input) void run(async () => setModel(await rpc.equity.views.modelRound(input)));
  };

  const save = () => {
    const input = terms();
    if (!input || !name.trim()) {
      if (input) setError(t`Name the scenario to save it`);
      return;
    }
    void run(async () => {
      const saved = scenarioId
        ? await rpc.equity.views.scenarios.update({ id: scenarioId, name: name.trim(), ...input })
        : await rpc.equity.views.scenarios.create({ name: name.trim(), ...input });
      setScenarios((current) => [saved, ...current.filter((row) => row.id !== saved.id)]);
      setScenarioId(saved.id);
      enqueueNotificationToast({ id: "scenario-saved", title: t`Saved ${saved.name}` });
    });
  };

  const setInvestment = (index: number, patch: Partial<Investment>) =>
    setInvestments((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  return (
    <div className="flex flex-col gap-4">
      {scenarios.length > 0 ? (
        <NativeSelect
          aria-label={t`Scenario`}
          className="w-fit"
          value={scenarioId}
          onChange={(event) => load(event.target.value)}
        >
          <NativeSelectOption value="">{t`New scenario`}</NativeSelectOption>
          {scenarios.map((row) => (
            <NativeSelectOption key={row.id} value={row.id}>
              {row.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
      <div className="grid max-w-xl grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="model-pre-money">{t`Pre-money valuation`}</FieldLabel>
          <Input
            id="model-pre-money"
            inputMode="decimal"
            value={preMoney}
            onChange={(e) => setPreMoney(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="model-pool">{t`Pool after the round (%)`}</FieldLabel>
          <Input
            id="model-pool"
            inputMode="decimal"
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          />
        </Field>
        {investments.map((row, index) => (
          <div key={index} className="contents">
            <Input
              aria-label={t`Investor ${index + 1}`}
              placeholder={t`Investor`}
              value={row.name}
              onChange={(e) => setInvestment(index, { name: e.target.value })}
            />
            <Input
              aria-label={t`Amount ${index + 1}`}
              placeholder={t`Amount`}
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => setInvestment(index, { amount: e.target.value })}
            />
          </div>
        ))}
      </div>
      {convertibles.length > 0 ? (
        <div className="flex flex-col gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            aria-expanded={pickConvertibles}
            onClick={() => setPickConvertibles((open) => !open)}
          >
            {t`Converting ${convertibles.length - excluded.size} of ${convertibles.length} convertibles`}
          </Button>
          {pickConvertibles ? (
            <ul className="flex flex-col gap-1 ps-3">
              {convertibles.map((row) => (
                <li key={row.id} className="flex items-center gap-2">
                  <Checkbox
                    aria-label={row.label}
                    checked={!excluded.has(row.id)}
                    onCheckedChange={(on) =>
                      setExcluded((current) => {
                        const next = new Set(current);
                        if (on === true) next.delete(row.id);
                        else next.add(row.id);
                        return next;
                      })
                    }
                  />
                  <span>{row.label}</span>
                  <span className="text-muted-foreground">
                    {row.stakeholderName} · {formatDollars(row.principalCents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setInvestments((current) => [...current, { name: "", amount: "" }])}
        >
          {t`Add investor`}
        </Button>
        <Button size="sm" disabled={busy} onClick={modelIt}>
          {t`Model`}
        </Button>
        {model || scenarioId ? (
          <>
            <Input
              aria-label={t`Scenario name`}
              placeholder={t`Scenario name`}
              className="ms-auto w-48"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={save}>
              {t`Save scenario`}
            </Button>
          </>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {model ? (
        <div className="flex flex-col gap-3">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t`Price per share`}</dt>
              <dd className="font-semibold tabular-nums">
                ${model.pricePerShare.replace(/(\.\d{4})\d*$/, "$1")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t`Post-money`}</dt>
              <dd className="font-semibold tabular-nums">
                {formatDollars(model.postMoneyValuationCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t`Post-money fully diluted`}</dt>
              <dd className="font-semibold tabular-nums">
                {formatShares(model.postMoneyFullyDilutedShares)}
              </dd>
            </div>
            <Button
              className="ms-auto self-center"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  `pro-forma-${model.asOf}.csv`,
                  toCsv(
                    [
                      { key: "name", label: t`Holder` },
                      { key: "preShares", label: t`Before` },
                      { key: "prePercent", label: t`Before %` },
                      { key: "postShares", label: t`After` },
                      { key: "postPercent", label: t`After %` },
                    ],
                    model.rows.map((row) => ({
                      ...row,
                      name: row.kind === "pool" ? t`Option pool` : row.name,
                    })),
                  ),
                )
              }
            >
              {t`Download CSV`}
            </Button>
          </dl>
          <div className="overflow-x-auto">
            <Table compact className="whitespace-nowrap">
              <TableHeader>
                <TableHeadRow>
                  <TableHead>{t`Holder`}</TableHead>
                  <TableHead className="text-end">{t`Before`}</TableHead>
                  <TableHead className="text-end">{t`Before %`}</TableHead>
                  <TableHead className="text-end">{t`After`}</TableHead>
                  <TableHead className="text-end">{t`After %`}</TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody aria-label={t`Pro forma`}>
                {model.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className={row.kind === "existing" ? undefined : "font-medium"}>
                      {row.kind === "pool" ? t`Option pool` : row.name}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatShares(row.preShares)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatPercent(row.prePercent)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatShares(row.postShares)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatPercent(row.postPercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

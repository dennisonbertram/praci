import { t } from "@lingui/core/macro";
import type {
  EquityDraftSet,
  EquityDraftSetReview,
  EquityShareClass,
  EquityStakeholder,
} from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { centsToDollars, dollarsToCents } from "../views/money";
import { formatCents, formatShares } from "./format";

export type DraftKind = "certificate" | "convertible";

/** One editable row; amounts stay as typed until they are saved. */
type Row = {
  stakeholderId: string;
  shareClassId: string;
  quantity: string;
  pricePerShare: string;
  kind: "safe" | "note";
  principal: string;
  cap: string;
  discount: string;
  issueDate: string;
  original?: Record<string, unknown>;
  isNew: boolean;
};

const blank = (): Row => ({
  stakeholderId: "",
  shareClassId: "",
  quantity: "",
  pricePerShare: "",
  kind: "safe",
  principal: "",
  cap: "",
  discount: "",
  issueDate: today(),
  original: {},
  isNew: true,
});

const centsText = (value: unknown) =>
  typeof value === "string" && /^\d+$/.test(value) ? centsToDollars(value) : "";

function fromItem(item: Record<string, unknown>): Row {
  const text = (key: string) => (typeof item[key] === "string" ? (item[key] as string) : "");
  return {
    ...blank(),
    stakeholderId: text("stakeholderId"),
    shareClassId: text("shareClassId"),
    quantity: text("quantity"),
    pricePerShare: text("pricePerShare"),
    kind: item.kind === "note" ? "note" : "safe",
    principal: centsText(item.principalCents),
    cap: centsText(item.valuationCapCents),
    discount: text("discountPercent"),
    issueDate: text("issueDate") || today(),
    original: { ...item },
    isNew: false,
  };
}

/** The create input of one row, or a reason it is not complete yet. */
export function toItem(kind: DraftKind, row: Row): Record<string, unknown> | string {
  if (!row.stakeholderId) return t`Choose a stakeholder`;
  if (!row.issueDate) return t`Choose an issue date`;
  if (kind === "certificate") {
    if (!row.shareClassId) return t`Choose a share class`;
    const quantity = row.quantity.replace(/[,\s]/g, "");
    if (!/^\d+$/.test(quantity) || BigInt(quantity) === 0n)
      return t`Enter a whole number of shares`;
    if (row.pricePerShare && !/^\d{1,14}(\.\d{1,10})?$/.test(row.pricePerShare))
      return t`Enter a price like 1.25`;
    const certificate: Record<string, unknown> = {
      ...row.original,
      stakeholderId: row.stakeholderId,
      shareClassId: row.shareClassId,
      quantity,
      issueDate: row.issueDate,
      pricePerShare: row.pricePerShare || null,
    };
    if (row.isNew) certificate.pricePaidPerShare = row.pricePerShare || null;
    return certificate;
  }
  const principalCents = dollarsToCents(row.principal);
  if (!principalCents || BigInt(principalCents) === 0n) return t`Enter the amount in dollars`;
  const capCents = row.cap ? dollarsToCents(row.cap) : null;
  if (row.cap && !capCents) return t`Enter the cap in dollars`;
  if (row.discount && !/^\d{1,2}(\.\d{1,10})?$/.test(row.discount))
    return t`Enter a discount like 20`;
  const originalCapType = row.original?.valuationCapType;
  const hadOriginalCap = row.original?.valuationCapCents != null;
  return {
    ...row.original,
    stakeholderId: row.stakeholderId,
    kind: row.kind,
    principalCents,
    issueDate: row.issueDate,
    valuationCapCents:
      capCents ?? (hadOriginalCap ? null : (row.original?.valuationCapCents as null | undefined)),
    valuationCapType: capCents
      ? originalCapType === "pre_money" || originalCapType === "post_money"
        ? originalCapType
        : "post_money"
      : hadOriginalCap
        ? null
        : (originalCapType as string | null | undefined),
    discountPercent: row.discount || null,
  };
}

/** A draft set: name it, add securities, save; then review it against the ledger and issue. */
export function DraftSetEditor({
  kind,
  set,
  onOpenChange,
  onChanged,
}: {
  kind: DraftKind;
  set: EquityDraftSet | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [name, setName] = useState(set?.name ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    set?.items.length ? set.items.map(fromItem) : [blank()],
  );
  const [saved, setSaved] = useState<EquityDraftSet | null>(set);
  const [review, setReview] = useState<EquityDraftSetReview | null>(null);
  const [stakeholders, setStakeholders] = useState<EquityStakeholder[]>([]);
  const [classes, setClasses] = useState<EquityShareClass[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    rpc.equity.stakeholders
      .list({ pageSize: 500, sort: { field: "name", dir: "asc" } })
      .then((page) => setStakeholders(page.items))
      .catch((cause: unknown) => setError(errorText(cause)));
    if (kind === "certificate")
      rpc.equity.shareClasses
        .list({ pageSize: 500 })
        .then((page) => setClasses(page.items))
        .catch((cause: unknown) => setError(errorText(cause)));
  }, [kind]);

  const patch = (index: number, change: Partial<Row>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...change } : row)));

  const run = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const refresh = async () => {
    try {
      await onChanged();
      setRefreshPending(false);
    } catch (cause) {
      setRefreshPending(true);
      throw cause;
    }
  };

  const save = async (): Promise<EquityDraftSet | null> => {
    if (refreshPending && saved) {
      await refresh();
      return saved;
    }
    if (!name.trim()) {
      setError(t`Name the draft set`);
      return null;
    }
    const items: Record<string, unknown>[] = [];
    for (const [index, row] of rows.entries()) {
      const item = toItem(kind, row);
      if (typeof item === "string") {
        setError(t`Row ${index + 1}: ${item}`);
        return null;
      }
      items.push(item);
    }
    const next = saved
      ? await rpc.equity.draftSets.update({
          id: saved.id,
          expectedRevision: saved.revision,
          name: name.trim(),
          items,
        })
      : await rpc.equity.draftSets.create({ name: name.trim(), securityKind: kind, items });
    setSaved(next);
    await refresh();
    return next;
  };

  const title = saved
    ? saved.name
    : kind === "certificate"
      ? t`New shares draft set`
      : t`New SAFEs and convertibles draft set`;
  const issued = saved?.status === "issued";
  const locked = busy || issued || refreshPending;
  const holder = (id: string) => stakeholders.find((item) => item.id === id)?.name ?? "";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && (busy || (review && !issued))) return;
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{review ? t`Review ${title}` : title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {review ? (
            <div className="flex flex-col gap-2 text-sm">
              <ul className="flex flex-col gap-1">
                {rows.map((row, index) => (
                  <li key={index} className="flex flex-wrap gap-x-3">
                    <span>{holder(row.stakeholderId)}</span>
                    {kind === "certificate" ? (
                      <span className="text-muted-foreground">
                        {classes.find((item) => item.id === row.shareClassId)?.name}
                      </span>
                    ) : null}
                    <span className="tabular-nums text-muted-foreground">
                      {kind === "certificate"
                        ? formatShares(row.quantity.replace(/[,\s]/g, "") || "0")
                        : `${row.kind === "safe" ? t`SAFE` : t`Note`} ${formatCents(dollarsToCents(row.principal) ?? "0")}`}
                    </span>
                    {review.items[index]?.problems.length ? (
                      <span className="text-destructive">
                        {review.items[index]!.problems.join(", ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="tabular-nums">
                {kind === "certificate"
                  ? t`${rows.length} certificates, ${formatShares(review.totalShares)} shares`
                  : t`${rows.length} convertibles, ${formatCents(review.totalPrincipalCents)}`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="draft-name">{t`Name`}</Label>
                <Input
                  id="draft-name"
                  value={name}
                  disabled={locked}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              {rows.map((row, index) => (
                <fieldset
                  key={index}
                  aria-label={t`Security ${index + 1}`}
                  className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[2fr_1.5fr_1fr_1fr_10rem_auto]"
                  disabled={locked}
                >
                  <NativeSelect
                    aria-label={t`Stakeholder`}
                    value={row.stakeholderId}
                    onChange={(event) => patch(index, { stakeholderId: event.target.value })}
                  >
                    <NativeSelectOption value="">{t`Stakeholder`}</NativeSelectOption>
                    {stakeholders.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {kind === "certificate" ? (
                    <>
                      <NativeSelect
                        aria-label={t`Share class`}
                        value={row.shareClassId}
                        onChange={(event) => patch(index, { shareClassId: event.target.value })}
                      >
                        <NativeSelectOption value="">{t`Share class`}</NativeSelectOption>
                        {classes.map((item) => (
                          <NativeSelectOption key={item.id} value={item.id}>
                            {item.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Input
                        aria-label={t`Shares`}
                        placeholder={t`Shares`}
                        inputMode="numeric"
                        value={row.quantity}
                        onChange={(event) => patch(index, { quantity: event.target.value })}
                      />
                      <Input
                        aria-label={t`Price per share`}
                        placeholder={t`Price`}
                        inputMode="decimal"
                        value={row.pricePerShare}
                        onChange={(event) => patch(index, { pricePerShare: event.target.value })}
                      />
                    </>
                  ) : (
                    <>
                      <NativeSelect
                        aria-label={t`Kind`}
                        value={row.kind}
                        onChange={(event) =>
                          patch(index, { kind: event.target.value as Row["kind"] })
                        }
                      >
                        <NativeSelectOption value="safe">{t`SAFE`}</NativeSelectOption>
                        <NativeSelectOption value="note">{t`Note`}</NativeSelectOption>
                      </NativeSelect>
                      <Input
                        aria-label={t`Amount ($)`}
                        placeholder={t`Amount ($)`}
                        inputMode="decimal"
                        value={row.principal}
                        onChange={(event) => patch(index, { principal: event.target.value })}
                      />
                      <Input
                        aria-label={t`Valuation cap ($)`}
                        placeholder={t`Cap ($)`}
                        inputMode="decimal"
                        value={row.cap}
                        onChange={(event) => patch(index, { cap: event.target.value })}
                      />
                    </>
                  )}
                  <Input
                    aria-label={t`Issue date`}
                    type="date"
                    value={row.issueDate}
                    onChange={(event) => patch(index, { issueDate: event.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t`Remove security ${index + 1}`}
                    disabled={locked || rows.length === 1}
                    onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </fieldset>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={locked}
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    {
                      ...blank(),
                      ...(current.at(-1)
                        ? {
                            issueDate: current.at(-1)!.issueDate,
                            shareClassId: current.at(-1)!.shareClassId,
                          }
                        : {}),
                    },
                  ])
                }
              >
                {t`Add security`}
              </Button>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {review ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => (issued ? onOpenChange(false) : setReview(null))}
              >
                {issued ? t`Close` : t`Back`}
              </Button>
              {issued ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await refresh();
                      onOpenChange(false);
                    })
                  }
                >
                  {t`Refresh`}
                </Button>
              ) : (
                <Button
                  disabled={busy || !review.ready}
                  onClick={() =>
                    void run(async () => {
                      const result = await rpc.equity.draftSetActions.issue({
                        id: saved!.id,
                        expectedRevision: saved!.revision,
                      });
                      setSaved(result.set);
                      await refresh();
                      onOpenChange(false);
                    })
                  }
                >
                  {t`Issue`}
                </Button>
              )}
            </>
          ) : refreshPending && saved ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run(async () => await refresh())}
            >
              {t`Refresh`}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={locked}
                onClick={() => void run(async () => void (await save()))}
              >
                {t`Save draft`}
              </Button>
              <Button
                disabled={locked}
                onClick={() =>
                  void run(async () => {
                    const next = await save();
                    if (next)
                      setReview(
                        await rpc.equity.draftSetActions.review({
                          id: next.id,
                          expectedRevision: next.revision,
                        }),
                      );
                  })
                }
              >
                {t`Review`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

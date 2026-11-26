import { t } from "@lingui/core/macro";
import type {
  EquityConvertible,
  EquityPricedRoundPreview,
  EquityShareClass,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { dollarsToCents } from "../views/money";
import { formatCents, formatPrice, formatShares } from "./format";

const methodLabel = (method: "cap" | "discount" | "round") =>
  ({ cap: t`Cap`, discount: t`Discount`, round: t`Round price` })[method];

/** Cancel one SAFE or note, or convert SAFEs and notes in a priced round after a preview. */
export function ConvertibleActionDialog({
  action,
  convertibles,
  onOpenChange,
  onDone,
}: {
  action: "cancel" | "priced-round";
  convertibles: EquityConvertible[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [classId, setClassId] = useState("");
  const [preMoney, setPreMoney] = useState("");
  const [newMoney, setNewMoney] = useState("");
  const [classes, setClasses] = useState<EquityShareClass[]>([]);
  // The funding round the new certificates belong to: none, an existing one, or "new" by name.
  const [roundChoice, setRoundChoice] = useState("");
  const [roundName, setRoundName] = useState("");
  const [rounds, setRounds] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<EquityPricedRoundPreview | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const first = convertibles[0]!;

  useEffect(() => {
    if (action !== "priced-round") return;
    rpc.equity.shareClasses
      .list({ pageSize: 500 })
      .then((page) => setClasses(page.items))
      .catch((cause: unknown) => setError(errorText(cause)));
    rpc.equity.fundingRounds
      .list({ pageSize: 200 })
      .then((page) => setRounds(page.items))
      .catch(() => undefined);
  }, [action]);

  const roundInput = () => {
    const preMoneyValuationCents = dollarsToCents(preMoney);
    const newMoneyCents = dollarsToCents(newMoney || "0");
    if (!classId) return t`Choose the class they convert into`;
    if (!preMoneyValuationCents || BigInt(preMoneyValuationCents) === 0n)
      return t`Enter the pre-money valuation in dollars`;
    if (!newMoneyCents) return t`Enter the new money in dollars`;
    if (roundChoice === "new" && !roundName.trim()) return t`Name the new round`;
    return {
      ...(roundChoice === "new"
        ? { newRoundName: roundName.trim() }
        : roundChoice
          ? { roundId: roundChoice }
          : {}),
      convertibleIds: convertibles.map((row) => row.id),
      toShareClassId: classId,
      preMoneyValuationCents,
      newMoneyCents,
      asOf: date,
    };
  };

  const run = async (work: () => Promise<void>) => {
    setSaving(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (action === "cancel") {
      if (!reason.trim()) return setError(t`Enter a reason`);
      return void run(async () => {
        await rpc.equity.convertibleTransactions.cancel({
          id: first.id,
          canceledOn: date,
          reason: reason.trim(),
        });
        onDone();
      });
    }
    const input = roundInput();
    if (typeof input === "string") return setError(input);
    if (!preview)
      return void run(async () => {
        setPreview(await rpc.equity.convertibleTransactions.previewPricedRound(input));
      });
    return void run(async () => {
      await rpc.equity.convertibleTransactions.convertPricedRound(input);
      onDone();
    });
  };

  const title =
    action === "cancel"
      ? t`Cancel ${first.label}`
      : convertibles.length === 1
        ? t`Convert ${first.label} in a priced round`
        : t`Convert ${convertibles.length} convertibles in a priced round`;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className={preview ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{preview ? t`Review` : title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {preview ? (
            <div className="flex flex-col gap-3 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                <dt className="text-muted-foreground">{t`Round price`}</dt>
                <dd className="tabular-nums">{formatPrice(preview.pricePerShare, 4)}</dd>
                <dt className="text-muted-foreground">{t`Pre-round fully diluted`}</dt>
                <dd className="tabular-nums">{formatShares(preview.preRoundFullyDilutedShares)}</dd>
                <dt className="text-muted-foreground">{t`New money shares`}</dt>
                <dd className="tabular-nums">{formatShares(preview.newMoneyShares)}</dd>
                <dt className="text-muted-foreground">{t`Post-round fully diluted`}</dt>
                <dd className="tabular-nums">
                  {formatShares(preview.postRoundFullyDilutedShares)}
                </dd>
              </dl>
              <Table>
                <TableHeader>
                  <TableHeadRow>
                    <TableHead>{t`Security`}</TableHead>
                    <TableHead>{t`Stakeholder`}</TableHead>
                    <TableHead className="text-end">{t`Converts`}</TableHead>
                    <TableHead>{t`Price from`}</TableHead>
                    <TableHead className="text-end">{t`Price`}</TableHead>
                    <TableHead className="text-end">{t`Shares`}</TableHead>
                  </TableHeadRow>
                </TableHeader>
                <TableBody>
                  {preview.convertibles.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>{row.stakeholderName}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatCents(row.amountConvertedCents)}
                      </TableCell>
                      <TableCell>{methodLabel(row.method)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatPrice(row.conversionPrice, 4)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatShares(row.shares)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {action === "priced-round" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="round-class">{t`Converts into`}</Label>
                    <NativeSelect
                      id="round-class"
                      value={classId}
                      onChange={(event) => setClassId(event.target.value)}
                    >
                      <NativeSelectOption value="">{t`Choose a share class`}</NativeSelectOption>
                      {classes.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="round-pre">{t`Pre-money valuation ($)`}</Label>
                    <Input
                      id="round-pre"
                      inputMode="decimal"
                      value={preMoney}
                      onChange={(event) => setPreMoney(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="round-pick">{t`Funding round`}</Label>
                    <NativeSelect
                      id="round-pick"
                      value={roundChoice}
                      onChange={(event) => setRoundChoice(event.target.value)}
                    >
                      <NativeSelectOption value="">{t`No round`}</NativeSelectOption>
                      {rounds.map((item) => (
                        <NativeSelectOption key={item.id} value={item.id}>
                          {item.name}
                        </NativeSelectOption>
                      ))}
                      <NativeSelectOption value="new">{t`New round…`}</NativeSelectOption>
                    </NativeSelect>
                    {roundChoice === "new" ? (
                      <Input
                        aria-label={t`Round name`}
                        value={roundName}
                        onChange={(event) => setRoundName(event.target.value)}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="round-new">{t`New money ($)`}</Label>
                    <Input
                      id="round-new"
                      inputMode="decimal"
                      value={newMoney}
                      onChange={(event) => setNewMoney(event.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cancel-reason">{t`Reason`}</Label>
                  <Input
                    id="cancel-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="convertible-date">
                  {action === "cancel" ? t`Canceled on` : t`Closing date`}
                </Label>
                <Input
                  id="convertible-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => (preview ? setPreview(null) : onOpenChange(false))}
          >
            {preview ? t`Back` : t`Close`}
          </Button>
          <Button
            variant={action === "cancel" ? "destructive" : "default"}
            disabled={saving}
            onClick={next}
          >
            {action === "cancel" ? t`Cancel convertible` : preview ? t`Confirm` : t`Preview`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

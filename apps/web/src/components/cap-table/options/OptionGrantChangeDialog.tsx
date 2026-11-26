import { t } from "@lingui/core/macro";
import type {
  EquityOptionGrant,
  EquityTerminationResult,
  EquityVestingTemplate,
} from "@rakazo/contracts";
import { describeVesting, parseFixed } from "@rakazo/core/equity";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatShares as figure, formatDay } from "./format";
import type { OptionGrantAction } from "./OptionGrantsTable";
import type { VestingRuleValue } from "./VestingTemplateForm";
import {
  DEFAULT_VESTING_RULE,
  parseVestingRule,
  VestingRuleFields,
  vestingRuleOf,
} from "./VestingTemplateForm";

/** The row menu actions that change a grant's terms or its holder's employment. */
export type OptionGrantChange = Extract<
  OptionGrantAction,
  | "modifyGrant"
  | "modifyVesting"
  | "accelerateVesting"
  | "modifyPostTermination"
  | "addAdminNotes"
  | "terminateStakeholder"
  | "reverseTermination"
>;

export const OPTION_GRANT_CHANGES: readonly OptionGrantChange[] = [
  "modifyGrant",
  "modifyVesting",
  "accelerateVesting",
  "modifyPostTermination",
  "addAdminNotes",
  "terminateStakeholder",
  "reverseTermination",
];

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isPrice = (value: string) => /^\d+(\.\d{1,10})?$/.test(value);

function titleOf(action: OptionGrantChange): string {
  switch (action) {
    case "modifyGrant":
      return t`Modify option grant`;
    case "modifyVesting":
      return t`Modify vesting schedule`;
    case "accelerateVesting":
      return t`Accelerate vesting`;
    case "modifyPostTermination":
      return t`Modify post-termination period`;
    case "addAdminNotes":
      return t`Add admin notes`;
    case "terminateStakeholder":
      return t`Terminate stakeholder`;
    case "reverseTermination":
      return t`Reverse termination`;
  }
}

/** One change to a grant or its holder: edit, review, then commit. */
export function OptionGrantChangeDialog({
  action,
  grant,
  onClose,
  onDone,
}: {
  action: OptionGrantChange;
  grant: EquityOptionGrant;
  onClose: () => void;
  onDone: () => void;
}) {
  const schedule = grant.vestingSchedule;
  const [price, setPrice] = useState(grant.exercisePrice);
  const [expiration, setExpiration] = useState(grant.expirationDate ?? "");
  const [rule, setRule] = useState<VestingRuleValue>(
    schedule ? vestingRuleOf(schedule as unknown as EquityVestingTemplate) : DEFAULT_VESTING_RULE,
  );
  const [start, setStart] = useState(schedule?.startDate ?? grant.grantDate);
  const [shares, setShares] = useState("");
  const [months, setMonths] = useState(String(grant.postTerminationExerciseMonths ?? 3));
  const [notes, setNotes] = useState(grant.adminNotes ?? "");
  const [date, setDate] = useState(today());
  const [reviewing, setReviewing] = useState(action === "reverseTermination");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<EquityTerminationResult | null>(null);

  const parsedRule = parseVestingRule(rule);
  const unvested = BigInt(grant.quantity) - BigInt(grant.vestedQuantity);

  let valid = true;
  let review: [string, string][] = [];
  let fields: ReactNode = null;
  const input = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    type = "text",
  ) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type={type} value={value} onChange={(event) => set(event.target.value)} />
    </Field>
  );

  switch (action) {
    case "modifyGrant":
      valid = isPrice(price) && (expiration === "" || isDate(expiration));
      fields = (
        <>
          {input("change-price", t`Exercise price`, price, setPrice)}
          {input("change-expiration", t`Expiration`, expiration, setExpiration, "date")}
        </>
      );
      review = [
        [t`Exercise price`, `${grant.exercisePrice} → ${price}`],
        [t`Expiration`, `${grant.expirationDate ?? "—"} → ${expiration || "—"}`],
      ];
      break;
    case "modifyVesting":
      valid = parsedRule != null && isDate(start);
      fields = (
        <>
          {input("change-start", t`Vesting start`, start, setStart, "date")}
          <VestingRuleFields value={rule} onChange={setRule} />
        </>
      );
      review = [
        [t`Vesting start`, formatDay(start)],
        [
          t`Vesting`,
          parsedRule
            ? describeVesting({
                startDate: start,
                ...parsedRule,
                tranches: parsedRule.tranches?.map((tranche) => ({
                  monthOffset: tranche.monthOffset,
                  percent: parseFixed(tranche.percent),
                })),
              })
            : "",
        ],
      ];
      break;
    case "accelerateVesting":
      valid =
        schedule != null && /^[1-9]\d*$/.test(shares) && BigInt(shares) <= unvested && isDate(date);
      fields = (
        <>
          {input("change-shares", t`Shares to vest`, shares, (v) => setShares(v.trim()))}
          {input("change-date", t`Date`, date, setDate, "date")}
        </>
      );
      review = [
        [t`Shares to vest`, /^\d+$/.test(shares) ? figure(shares) : shares],
        [t`Unvested`, figure(unvested.toString())],
        [t`Date`, formatDay(date)],
      ];
      break;
    case "modifyPostTermination":
      valid = /^\d{1,3}$/.test(months);
      fields = input("change-months", t`Months to exercise after termination`, months, setMonths);
      review = [[t`Months`, `${grant.postTerminationExerciseMonths ?? 3} → ${months}`]];
      break;
    case "addAdminNotes":
      fields = (
        <Field>
          <FieldLabel htmlFor="change-notes">{t`Admin notes`}</FieldLabel>
          <Textarea
            id="change-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
      );
      review = [[t`Admin notes`, notes || "—"]];
      break;
    case "terminateStakeholder":
      valid = isDate(date);
      fields = input("change-date", t`Termination date`, date, setDate, "date");
      review = [
        [t`Stakeholder`, grant.stakeholderName],
        [t`Termination date`, formatDay(date)],
        ...(preview?.grants ?? []).map((row): [string, string] => [
          row.label,
          t`${figure(row.forfeitedQuantity)} forfeited, exercise by ${row.exerciseDeadline ? formatDay(row.exerciseDeadline) : "—"}`,
        ]),
      ];
      break;
    case "reverseTermination":
      review = [[t`Stakeholder`, grant.stakeholderName]];
      break;
  }

  async function review_() {
    setError(null);
    if (action === "terminateStakeholder") {
      setBusy(true);
      try {
        setPreview(
          await rpc.equity.optionActions.previewTermination({
            stakeholderId: grant.stakeholderId,
            terminatedOn: date,
          }),
        );
      } catch (caught) {
        setError(errorText(caught));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setReviewing(true);
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const update = rpc.equity.optionGrants.update;
      const actions = rpc.equity.optionActions;
      const keep = schedule && {
        templateId: schedule.templateId,
        startDate: schedule.startDate,
        totalMonths: schedule.totalMonths,
        cliffMonths: schedule.cliffMonths,
        frequencyMonths: schedule.frequencyMonths,
        tranches: schedule.tranches,
        acceleratedShares: schedule.acceleratedShares,
        acceleratedOn: schedule.acceleratedOn,
        stoppedOn: schedule.stoppedOn,
      };
      if (action === "modifyGrant")
        await update({
          id: grant.id,
          exercisePrice: price,
          expirationDate: expiration || null,
          reason: "amendment",
        });
      else if (action === "modifyVesting" && parsedRule)
        await update({
          id: grant.id,
          vesting: { ...keep, templateId: null, startDate: start, ...parsedRule },
          reason: "amendment",
        });
      else if (action === "accelerateVesting" && keep)
        await update({
          id: grant.id,
          vesting: {
            ...keep,
            acceleratedShares: (BigInt(keep.acceleratedShares ?? "0") + BigInt(shares)).toString(),
            acceleratedOn: date,
          },
          reason: "amendment",
        });
      else if (action === "modifyPostTermination")
        await actions.setPostTerminationPeriod({
          optionGrantId: grant.id,
          postTerminationExerciseMonths: Number.parseInt(months, 10),
        });
      else if (action === "addAdminNotes")
        await update({ id: grant.id, adminNotes: notes || null });
      else if (action === "terminateStakeholder")
        await actions.terminate({ stakeholderId: grant.stakeholderId, terminatedOn: date });
      else if (action === "reverseTermination")
        await actions.reverseTermination({ stakeholderId: grant.stakeholderId });
      onDone();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titleOf(action)}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reviewing ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {[[t`Security`, grant.label] as [string, string], ...review].map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex flex-col gap-4">{fields}</div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t`Cancel`}
          </Button>
          {reviewing ? (
            <Button onClick={() => void commit()} disabled={busy}>
              {t`Confirm`}
            </Button>
          ) : (
            <Button onClick={() => void review_()} disabled={!valid || busy}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

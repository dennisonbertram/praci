import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import type {
  EquityDraftSet,
  EquityOptionGrantCreateInput,
  EquityVestingTemplate,
} from "@rakazo/contracts";
import { describeVesting, vestingRuleOf } from "@rakazo/core/equity";
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
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { todayIso as today } from "../../../lib/legal-format";
import { listAllPages } from "../../../lib/list-all";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay, formatPrice } from "./format";

/** The schedule a template gives a grant starting on its grant date, e.g. "1/48 monthly, 1 year cliff". */
function scheduleText(template: EquityVestingTemplate | undefined, startDate: string): string {
  if (!template) return t`None`;
  return describeVesting(vestingRuleOf({ ...template, startDate }));
}

type Option = { id: string; name: string };

type Row = {
  key: number;
  stakeholderId: string;
  planId: string;
  optionType: "iso" | "nso";
  quantity: string;
  exercisePrice: string;
  grantDate: string;
  templateId: string;
};

const figure = (value: string) => new Intl.NumberFormat(i18n.locale || "en").format(BigInt(value));

const blankRow = (key: number, previous?: Row): Row => ({
  key,
  stakeholderId: previous?.stakeholderId ?? "",
  planId: previous?.planId ?? "",
  optionType: previous?.optionType ?? "iso",
  quantity: "",
  exercisePrice: previous?.exercisePrice ?? "",
  grantDate: previous?.grantDate ?? today(),
  templateId: previous?.templateId ?? "",
});

const rowValid = (row: Row) =>
  row.stakeholderId !== "" &&
  row.planId !== "" &&
  /^[1-9]\d*$/.test(row.quantity) &&
  /^\d+(\.\d{1,10})?$/.test(row.exercisePrice);

/** "Draft options": several new option grants, reviewed together and issued as one draft set. */
export function OptionDraftSetDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [holders, setHolders] = useState<Option[]>([]);
  const [plans, setPlans] = useState<Option[]>([]);
  const [templates, setTemplates] = useState<EquityVestingTemplate[]>([]);
  const [rows, setRows] = useState<Row[]>([blankRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSet, setCreatedSet] = useState<Pick<EquityDraftSet, "id" | "revision"> | null>(
    null,
  );
  const [issued, setIssued] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      listAllPages((page) => rpc.equity.stakeholders.list({ page, pageSize: 500 })),
      rpc.equity.plans.list({ pageSize: 100 }),
      rpc.equity.vestingTemplates.list({ pageSize: 100 }),
    ])
      .then(([holderPage, planPage, templatePage]) => {
        if (!live) return;
        setHolders(holderPage.map((item) => ({ id: item.id, name: item.name })));
        setPlans(planPage.items.map((item) => ({ id: item.id, name: item.name })));
        setTemplates(templatePage.items);
        setRows((current) =>
          current.map((row) => ({
            ...row,
            stakeholderId: row.stakeholderId || holderPage[0]?.id || "",
            planId: row.planId || planPage.items[0]?.id || "",
            templateId: row.templateId || templatePage.items[0]?.id || "",
          })),
        );
      })
      .catch((caught: unknown) => live && setError(errorText(caught)));
    return () => {
      live = false;
    };
  }, []);

  const valid = rows.length > 0 && rows.every(rowValid);
  const totalQuantity = rows.reduce(
    (sum, row) => sum + (/^\d+$/.test(row.quantity) ? BigInt(row.quantity) : 0n),
    0n,
  );
  const nameOf = (list: Option[], id: string) => list.find((item) => item.id === id)?.name ?? "";
  const templateOf = (id: string) => templates.find((item) => item.id === id);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function addRow() {
    const previous = rows[rows.length - 1];
    setRows((current) => [...current, blankRow(nextKey, previous)]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
  }

  async function issue() {
    if (busyRef.current || issued) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      let draft = createdSet;
      try {
        if (!draft) {
          const items: EquityOptionGrantCreateInput[] = rows.map((row) => {
            const template = templateOf(row.templateId);
            return {
              stakeholderId: row.stakeholderId,
              planId: row.planId,
              optionType: row.optionType,
              quantity: row.quantity,
              exercisePrice: row.exercisePrice,
              grantDate: row.grantDate,
              vesting: template
                ? {
                    templateId: template.id,
                    startDate: row.grantDate,
                    totalMonths: template.totalMonths,
                    cliffMonths: template.cliffMonths,
                    frequencyMonths: template.frequencyMonths,
                    tranches: template.tranches,
                  }
                : null,
            };
          });
          const created = await rpc.equity.draftSets.create({
            name: t`Option grants ${rows[0]?.grantDate ?? today()}`,
            securityKind: "option_grant",
            items,
          });
          draft = { id: created.id, revision: created.revision };
          setCreatedSet(draft);
        }
        await rpc.equity.optionActions.issueDraftSet({
          id: draft.id,
          expectedRevision: draft.revision,
        });
        setIssued(true);
      } catch (caught) {
        setError(errorText(caught));
        return;
      }
      try {
        await onSaved();
        onClose();
      } catch (caught) {
        setError(errorText(caught));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function refreshAfterIssue() {
    if (busyRef.current || !issued) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSaved();
      onClose();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const select = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Option[],
  ) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );

  function grantFields(row: Row) {
    const id = (field: string) => `draft-${row.key}-${field}`;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {select(
          id("holder"),
          t`Optionholder`,
          row.stakeholderId,
          (value) => update(row.key, { stakeholderId: value }),
          holders,
        )}
        {select(
          id("plan"),
          t`Plan`,
          row.planId,
          (value) => update(row.key, { planId: value }),
          plans,
        )}
        {select(
          id("type"),
          t`Type`,
          row.optionType,
          (value) => update(row.key, { optionType: value as "iso" | "nso" }),
          [
            { id: "iso", name: "ISO" },
            { id: "nso", name: "NSO" },
          ],
        )}
        <Field>
          <FieldLabel htmlFor={id("quantity")}>{t`Quantity`}</FieldLabel>
          <Input
            id={id("quantity")}
            inputMode="numeric"
            value={row.quantity}
            onChange={(event) => update(row.key, { quantity: event.target.value.trim() })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("price")}>{t`Exercise price`}</FieldLabel>
          <Input
            id={id("price")}
            inputMode="decimal"
            value={row.exercisePrice}
            onChange={(event) => update(row.key, { exercisePrice: event.target.value.trim() })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("date")}>{t`Grant date`}</FieldLabel>
          <Input
            id={id("date")}
            type="date"
            value={row.grantDate}
            onChange={(event) => update(row.key, { grantDate: event.target.value })}
          />
        </Field>
        {select(
          id("vesting"),
          t`Vesting`,
          row.templateId,
          (value) => update(row.key, { templateId: value }),
          [
            { id: "", name: t`None` },
            ...templates.map((item) => ({ id: item.id, name: item.name })),
          ],
        )}
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t`Draft options`}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {reviewing ? (
            <div className="flex flex-col gap-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 font-normal">{t`Optionholder`}</th>
                    <th className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 font-normal">{t`Plan`}</th>
                    <th className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 font-normal">{t`Type`}</th>
                    <th className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 text-right font-normal">{t`Quantity`}</th>
                    <th className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 text-right font-normal">{t`Exercise price`}</th>
                    <th className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 font-normal">{t`Grant date`}</th>
                    <th className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 font-normal">{t`Vesting`}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0">
                        {nameOf(holders, row.stakeholderId)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0">
                        {nameOf(plans, row.planId)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0">
                        {row.optionType.toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 text-right tabular-nums">
                        {rowValid(row) ? figure(row.quantity) : row.quantity}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0 text-right tabular-nums">
                        {formatPrice(row.exercisePrice)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0">
                        {formatDay(row.grantDate)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 first:pl-0 last:pr-0">
                        {scheduleText(templateOf(row.templateId), row.grantDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td className="whitespace-nowrap px-2 py-2 first:pl-0 last:pr-0" colSpan={3}>
                      {t`Total`}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 first:pl-0 last:pr-0 text-right tabular-nums">
                      {new Intl.NumberFormat(i18n.locale || "en").format(totalQuantity)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {rows.map((row, index) => (
                <div key={row.key} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{t`Grant ${index + 1}`}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t`Remove grant ${index + 1}`}
                      onClick={() => removeRow(row.key)}
                      disabled={busy || rows.length === 1}
                    >
                      {t`Remove`}
                    </Button>
                  </div>
                  {grantFields(row)}
                </div>
              ))}
              <div>
                <Button variant="outline" onClick={addRow} disabled={busy}>
                  {t`Add grant`}
                </Button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={
              issued ? onClose : reviewing && !createdSet ? () => setReviewing(false) : onClose
            }
            disabled={busy}
          >
            {issued ? t`Close` : reviewing && !createdSet ? t`Back` : t`Cancel`}
          </Button>
          {reviewing && issued ? (
            <Button onClick={() => void refreshAfterIssue()} disabled={busy}>
              {t`Refresh`}
            </Button>
          ) : reviewing ? (
            <Button onClick={() => void issue()} disabled={busy || issued}>
              {plural(rows.length, { one: "Issue # grant", other: "Issue # grants" })}
            </Button>
          ) : (
            <Button onClick={() => setReviewing(true)} disabled={!valid}>
              {t`Review`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

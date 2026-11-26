import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact, PipelineStatus } from "@rakazo/contracts";
import {
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetTitle,
} from "@rakazo/ui-web";
import { Phone } from "lucide-react";
import { useState } from "react";
import { todayDay } from "../../lib/day-input";
import { usdFigure } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import type { PipelineRow, RowEdits } from "../../lib/pipeline-rows";
import { LogCallBody } from "./LogCall";
import {
  dayLabel,
  InterestChoice,
  NextCallFields,
  nextCallRowKey,
  nextCallValue,
  ReferredByPicker,
  statusNames,
  useNextCallSave,
} from "./PipelineControls";

/**
 * A draft that follows the row while the sheet is open: the base is always the row's current
 * value, and the draft moves to a new base only while it still equals the old one (untouched).
 * Comparing in render keeps a stale value from ever showing; a blur saves a draft only when it
 * differs from the base, so a reloaded value is never written back and a typed draft wins.
 */
function useSheetDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  if (base !== value) {
    setBase(value);
    if (draft === base) setDraft(value);
  }
  return [draft, setDraft, base] as const;
}

/** The phone's row sheet: every edit a row has, with Log call as its primary action. */
export function RowSheet({
  row,
  contacts,
  edits,
  logging: startLogging = false,
  onClose,
  onEditContact,
  onAskAbout,
  safe = {},
}: {
  row: PipelineRow;
  contacts: readonly Contact[] | null;
  edits: RowEdits;
  logging?: boolean;
  onClose: () => void;
  onEditContact: () => void;
  /** Sends a question to the page's docked agent; absent when the page has none. */
  onAskAbout?: (question: string) => void;
  /** The SAFE actions the row has: Send SAFE on Committed, Open Mercury and Not sent while waiting. */
  safe?: { send?: () => void; openMercury?: () => void; notSent?: () => void };
}) {
  const [logging, setLogging] = useState(startLogging);
  const names = statusNames();
  const hidden = useHideAmounts();
  const [step, setStep, stepBase] = useSheetDraft(row.nextStep ?? "");
  const { draft, save } = useNextCallSave(row, (next) => edits.nextCall(row, next));
  // A hidden amount is never held as digits: the input only shows the mask.
  const [amount, setAmount, amountBase] = useSheetDraft(
    hidden || row.amountCents == null ? "" : String(row.amountCents / 100),
  );
  const auto = row.lastAuto;
  const autoLine = auto
    ? auto.source === "mail"
      ? t`Updated from email: ${auto.summary} · ${dayLabel(todayDay(new Date(auto.at)))}`
      : t`Updated from calendar: ${auto.summary} · ${dayLabel(todayDay(new Date(auto.at)))}`
    : null;
  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (next) return;
        // Closing with a date still focused saves it rather than losing it with the sheet.
        void save(nextCallValue(draft.current));
        onClose();
      }}
    >
      <SheetContent>
        <SheetTitle>{logging ? t`Log call: ${row.name}` : row.name}</SheetTitle>
        {logging ? (
          <SheetBody>
            <LogCallBody
              row={row}
              onSave={(result) => {
                edits.log(row, result);
                onClose();
              }}
              onCancel={() => setLogging(false)}
            />
          </SheetBody>
        ) : (
          <>
            <SheetBody className="grid gap-3">
              {row.status === "not_reached" ? null : (
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium">
                    <Trans>Interest</Trans>
                  </span>
                  <InterestChoice row={row} onChange={(value) => edits.interest(row, value)} wide />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="sheet-status">
                  <Trans>Status</Trans>
                </Label>
                <NativeSelect
                  id="sheet-status"
                  value={row.status}
                  className="w-full pointer-coarse:h-11"
                  onChange={(event) => edits.status(row, event.target.value as PipelineStatus)}
                >
                  {(Object.keys(names) as PipelineStatus[]).map((id) => (
                    <NativeSelectOption key={id} value={id}>
                      {names[id]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {autoLine ? (
                  <p className="text-xs text-muted-foreground">
                    <span title={auto?.summary}>{autoLine}</span>{" "}
                    <Button
                      variant="link"
                      size="xs"
                      className="h-auto p-0 text-xs pointer-coarse:h-auto"
                      onClick={() => edits.undoAuto(row)}
                    >
                      <Trans>Undo</Trans>
                    </Button>
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sheet-step">
                  <Trans>Next step</Trans>
                </Label>
                <Input
                  id="sheet-step"
                  className="pointer-coarse:h-11"
                  value={step}
                  onChange={(event) => setStep(event.target.value)}
                  onBlur={() => step.trim() !== stepBase && edits.nextStep(row, step)}
                />
              </div>
              <NextCallFields
                key={nextCallRowKey(row)}
                row={row}
                idPrefix="sheet"
                inputClassName="pointer-coarse:h-11"
                onSave={(next) => void save(next)}
                draftRef={draft}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="sheet-amount">
                  <Trans>Possible amount</Trans>
                </Label>
                <Input
                  id="sheet-amount"
                  className="pointer-coarse:h-11"
                  inputMode="decimal"
                  placeholder={usdFigure(null, 0, i18n.locale || "en")}
                  disabled={hidden}
                  value={
                    hidden
                      ? row.amountCents == null
                        ? ""
                        : usdFigure(row.amountCents / 100, 0, i18n.locale || "en")
                      : amount
                  }
                  onChange={(event) => setAmount(event.target.value)}
                  onBlur={() => {
                    if (hidden) return;
                    if (amount !== amountBase) edits.amount(row, amount);
                  }}
                />
              </div>
              {contacts !== null ? (
                <div className="flex min-h-11 items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    <Trans>Referred by</Trans>
                  </span>
                  <ReferredByPicker
                    row={row}
                    contacts={contacts}
                    trigger={
                      row.referredBy?.name ?? (
                        <span className="underline">
                          <Trans>Add</Trans>
                        </span>
                      )
                    }
                    onPick={(id) => edits.referrer(row, id)}
                    onCreate={(name) => edits.createReferrer(row, name)}
                  />
                </div>
              ) : null}
              {row.details.length > 0 ? (
                <dl
                  data-testid="sheet-details"
                  className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm"
                >
                  {row.details.map((detail) => (
                    <div key={`${detail.label}-${detail.value}`} className="contents">
                      <dt className="text-muted-foreground">{detail.label}</dt>
                      <dd className="min-w-0 break-words">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <div className="flex flex-wrap gap-x-4">
                <Button variant="ghost" className="px-0" onClick={onEditContact}>
                  <Trans>Edit prospect</Trans>
                </Button>
                {safe.openMercury ? (
                  <Button variant="ghost" className="px-0" onClick={safe.openMercury}>
                    <Trans>Open Mercury</Trans>
                  </Button>
                ) : null}
                {safe.notSent ? (
                  <Button variant="ghost" className="px-0" onClick={safe.notSent}>
                    <Trans>Not sent</Trans>
                  </Button>
                ) : null}
              </div>
            </SheetBody>
            <SheetFooter className="flex-row gap-2">
              {safe.send ? (
                <Button variant="outline" size="lg" className="flex-1" onClick={safe.send}>
                  <Trans>Send SAFE</Trans>
                </Button>
              ) : null}
              {onAskAbout ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    const person = row.people[0]?.name;
                    onAskAbout(
                      person
                        ? t`Prep outreach for ${person} at ${row.name}`
                        : t`Prep outreach for ${row.name}`,
                    );
                    onClose();
                  }}
                >
                  <Trans>Prep outreach</Trans>
                </Button>
              ) : null}
              <Button size="lg" className="flex-1" onClick={() => setLogging(true)}>
                <Phone aria-hidden="true" />
                <Trans>Log call</Trans>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

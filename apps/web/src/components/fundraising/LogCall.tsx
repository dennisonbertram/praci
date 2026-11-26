import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { PipelineCallOutcome } from "@rakazo/contracts";
import { Button, Input, Textarea, Toggle } from "@rakazo/ui-web";
import { useState } from "react";
import type { LogCallResult, PipelineRow } from "../../lib/pipeline-rows";
import { callDay, inAWeek, nextWorkingDays } from "../../lib/pipeline-rows";
import { dayLabel } from "./PipelineControls";

const OUTCOMES: PipelineCallOutcome[] = ["spoke", "left_message", "no_answer"];
export const outcomeNames = (): Record<PipelineCallOutcome, string> => ({
  spoke: t`Spoke`,
  left_message: t`Left message`,
  no_answer: t`No answer`,
});

const weekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(i18n.locale || "en", {
    weekday: "short",
    timeZone: "UTC",
  });

/**
 * The one entry point after a call. "Left a message, try again Thursday" is Log, Left message,
 * Thu, Save. Keeping the old date leaves the row on the due list until a new date or None is chosen.
 */
export function LogCallBody({
  row,
  onSave,
  onCancel,
}: {
  row: PipelineRow;
  onSave: (result: LogCallResult) => void;
  onCancel?: () => void;
}) {
  const names = outcomeNames();
  const kept = callDay(row);
  const [outcome, setOutcome] = useState<PipelineCallOutcome | null>(null);
  const [next, setNext] = useState<LogCallResult["next"]>(kept ? "keep" : { day: null });
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const now = new Date();
  const choices: [string, string][] = [
    ...nextWorkingDays(now, 3).map((day): [string, string] => [day, weekday(day)]),
    [inAWeek(now), t`Next week`],
  ];
  const chosenDay = next !== "keep" ? next.day : null;
  const chip = (selected: boolean) =>
    selected ? "border-foreground font-semibold" : "text-muted-foreground";
  return (
    <div className="grid gap-3">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">
          <Trans>Outcome</Trans>
        </legend>
        <div className="flex gap-1.5">
          {OUTCOMES.map((option) => (
            <Toggle
              key={option}
              variant="outline"
              pressed={outcome === option}
              onPressedChange={() => setOutcome(option)}
              className={`h-9 flex-1 px-1.5 text-xs pointer-coarse:h-11 ${outcome === option ? "border-foreground font-semibold aria-pressed:bg-muted" : ""}`}
            >
              {names[option]}
            </Toggle>
          ))}
        </div>
      </fieldset>
      <Textarea
        aria-label={t`Note`}
        placeholder={t`Note`}
        rows={2}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          <Trans>Next call</Trans>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {kept ? (
            <Button
              variant="outline"
              size="xs"
              className={`${chip(next === "keep")} pointer-coarse:h-11`}
              aria-pressed={next === "keep"}
              onClick={() => {
                setPicking(false);
                setNext("keep");
              }}
            >
              {t`Keep ${dayLabel(kept)}`}
            </Button>
          ) : null}
          {choices.map(([day, label]) => (
            <Button
              key={day}
              variant="outline"
              size="xs"
              className={`${chip(chosenDay === day)} pointer-coarse:h-11`}
              aria-pressed={chosenDay === day}
              onClick={() => {
                setPicking(false);
                setNext({ day });
              }}
            >
              {label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="xs"
            className={`${chip(picking)} pointer-coarse:h-11`}
            aria-pressed={picking}
            onClick={() => setPicking(true)}
          >
            <Trans>Pick date</Trans>
          </Button>
          <Button
            variant="outline"
            size="xs"
            className={`${chip(chosenDay === null && next !== "keep" && !picking)} pointer-coarse:h-11`}
            aria-pressed={chosenDay === null && next !== "keep" && !picking}
            onClick={() => {
              setPicking(false);
              setNext({ day: null });
            }}
          >
            <Trans>None</Trans>
          </Button>
        </div>
        {picking ? (
          <Input
            aria-label={t`Next call date`}
            type="date"
            className="mt-1.5 pointer-coarse:h-11"
            onChange={(event) => setNext({ day: event.target.value || null })}
          />
        ) : null}
      </fieldset>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="outline" size="sm" className="pointer-coarse:h-11" onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
        ) : null}
        <Button
          size="sm"
          className="pointer-coarse:h-11"
          disabled={!outcome}
          onClick={() => outcome && onSave({ outcome, note, next })}
        >
          <Trans>Save</Trans>
        </Button>
      </div>
    </div>
  );
}

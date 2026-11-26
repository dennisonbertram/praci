import { t } from "@lingui/core/macro";
import { Button, Input, Label, Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";

/** An issue date range behind one toolbar button; the button shows the range once one is set. */
export function IssueDateFilter({
  from,
  to,
  onChange,
}: {
  from: string | undefined;
  to: string | undefined;
  onChange: (range: { from: string | undefined; to: string | undefined }) => void;
}) {
  const label = from || to ? `${from ?? "…"} – ${to ?? "…"}` : t`Issue dates`;
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>{label}</PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issued-from">{t`From`}</Label>
          <Input
            id="issued-from"
            type="date"
            value={from ?? ""}
            onChange={(event) => onChange({ from: event.target.value || undefined, to })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issued-to">{t`To`}</Label>
          <Input
            id="issued-to"
            type="date"
            value={to ?? ""}
            onChange={(event) => onChange({ from, to: event.target.value || undefined })}
          />
        </div>
        {from || to ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onChange({ from: undefined, to: undefined })}
          >
            {t`Any date`}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

import { Trans } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import { BotAvatar, Button, Checkbox, DialogDescription, DialogTitle } from "@rakazo/ui-web";
import { useState } from "react";

/** Step 2 of the connect dialogs: which agents get the new connection. All start checked. */
export function AgentStep({
  appName,
  bots,
  busy,
  error,
  onContinue,
  onSkip,
}: {
  appName: string;
  bots: Bot[];
  busy: boolean;
  error: string | null;
  onContinue: (botIds: string[]) => void;
  onSkip: () => void;
}) {
  const [checked, setChecked] = useState(() => new Set(bots.map((bot) => bot.id)));
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Trans>Step 2 of 3</Trans>
      </div>
      <DialogTitle>
        <Trans>Which agents can use {appName}?</Trans>
      </DialogTitle>
      <DialogDescription className="mb-3">
        <Trans>You can change this later.</Trans>
      </DialogDescription>
      <div className="space-y-1.5">
        {bots.map((bot) => (
          <label
            key={bot.id}
            htmlFor={`agent-${bot.id}`}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border px-2.5 py-2"
          >
            <Checkbox
              id={`agent-${bot.id}`}
              checked={checked.has(bot.id)}
              onCheckedChange={(next) =>
                setChecked((current) => {
                  const copy = new Set(current);
                  if (next) copy.add(bot.id);
                  else copy.delete(bot.id);
                  return copy;
                })
              }
            />
            <BotAvatar color={bot.color} identity={bot.id} size={22} />
            <span className="min-w-0 flex-1 truncate text-sm">{bot.name}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onSkip}>
          <Trans>Skip</Trans>
        </Button>
        <Button disabled={busy} onClick={() => onContinue([...checked])}>
          <Trans>Continue</Trans>
        </Button>
      </div>
    </div>
  );
}

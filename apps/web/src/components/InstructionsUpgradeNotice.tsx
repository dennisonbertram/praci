import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rakazo/ui-web";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type Upgrade = { current: string; next: string };

function Prompt({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        readOnly
        aria-label={label}
        value={text}
        className="h-48 resize-none overflow-auto rounded-md border bg-muted p-3 font-mono text-xs"
        dir="auto"
      />
    </div>
  );
}

/** Shows the stored system prompt beside the current default; Upgrade replaces it, Keep mine hides the notice. */
export function InstructionsUpgradeDialog({
  upgrade,
  busy,
  error,
  onUpgrade,
  onKeep,
  onClose,
}: {
  upgrade: Upgrade;
  busy: boolean;
  error: string | null;
  onUpgrade: () => void;
  onKeep: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Upgrade system prompt</Trans>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Prompt label={t`Current`} text={upgrade.current} />
          <Prompt label={t`New`} text={upgrade.next} />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onKeep}>
            <Trans>Keep mine</Trans>
          </Button>
          <Button type="button" disabled={busy} onClick={onUpgrade}>
            <Trans>Upgrade</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sits at the top of an agent's chat when its stored instructions differ from the agent's current
 * default. `instructions` is the stored text: a save in the agent's settings changes it and
 * fetches the offer again.
 */
export function InstructionsUpgradeNotice({
  botId,
  instructions,
  onUpgraded,
}: {
  botId: string;
  instructions: string;
  onUpgraded: (bot: Bot) => void;
}) {
  const [upgrade, setUpgrade] = useState<Upgrade | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a saved edit changes `instructions`
  const load = useCallback(async () => {
    try {
      setUpgrade((await rpc.bots.instructionsUpgrade({ botId })) ?? null);
    } catch {
      setUpgrade(null);
    }
  }, [botId, instructions]);

  useEffect(() => {
    setOpen(false);
    setError(null);
    void load();
  }, [load]);

  async function dismiss() {
    setBusy(true);
    try {
      await rpc.bots.dismissInstructionsUpgrade({ botId });
      setUpgrade(null);
      setOpen(false);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!upgrade) return;
    setBusy(true);
    try {
      const bot = await rpc.bots.upgradeInstructions({ botId, from: upgrade.current });
      setUpgrade(null);
      setOpen(false);
      onUpgraded(bot);
    } catch (cause) {
      setError(errorText(cause));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!upgrade) return null;
  return (
    <>
      <div
        data-testid="instructions-upgrade-notice"
        className="mx-4 mt-2 flex shrink-0 items-center gap-2 rounded-md border bg-muted px-3 py-1.5 text-sm md:mx-7"
      >
        <span className="min-w-0 flex-1">
          <Trans>Upgrade this agent's system prompt?</Trans>
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Trans>Review</Trans>
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t`Dismiss`}
          disabled={busy}
          onClick={() => void dismiss()}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      {open ? (
        <InstructionsUpgradeDialog
          upgrade={upgrade}
          busy={busy}
          error={error}
          onUpgrade={() => void accept()}
          onKeep={() => void dismiss()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

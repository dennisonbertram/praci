import { Trans } from "@lingui/react/macro";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import { useState } from "react";
import type { RecordAvailability } from "../../lib/meeting-capture/availability";
import {
  systemAudioSupported,
  tabAudioSupported,
  useRecordAvailability,
} from "../../lib/meeting-capture/availability";
import { startCapture } from "../../lib/meeting-capture/controller";
import { errorText } from "../../lib/user-error";
import { RecordForm } from "./RecordForm";

/** The red dot, in the destructive token. */
const Dot = () => <span aria-hidden="true" className="size-2 rounded-full bg-destructive" />;

/**
 * Record at the top right of the Meetings page. Hidden when the space policy is off (or unknown);
 * without a speech-to-text engine it becomes a link to set one up.
 */
export function RecordButton({ onAddSpeech }: { onAddSpeech?: () => void }) {
  const availability = useRecordAvailability();
  return <RecordButtonView availability={availability} onAddSpeech={onAddSpeech} />;
}

export function RecordButtonView({
  availability,
  onAddSpeech,
}: {
  availability: RecordAvailability;
  onAddSpeech?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!availability.loaded || availability.policy === "off") return null;
  if (!availability.engine)
    return (
      <Button variant="outline" onClick={onAddSpeech}>
        <Trans>Add speech to text</Trans>
      </Button>
    );
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError("");
      }}
    >
      <PopoverTrigger render={<Button />}>
        <Dot />
        <Trans>Record</Trans>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <RecordForm
          policy={availability.policy}
          tabAudioAvailable={systemAudioSupported() || tabAudioSupported()}
          systemAudio={systemAudioSupported()}
          busy={busy}
          error={error}
          onStart={(options) => {
            setBusy(true);
            setError("");
            startCapture(options)
              .then(() => setOpen(false))
              .catch((cause) => setError(errorText(cause)))
              .finally(() => setBusy(false));
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

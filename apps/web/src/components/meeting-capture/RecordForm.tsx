import { Trans, useLingui } from "@lingui/react/macro";
import { Button, Checkbox, Input } from "@rakazo/ui-web";
import { useId, useState } from "react";
import type { StartOptions } from "../../lib/meeting-capture/controller";
import { defaultMeetingTitle } from "../../lib/meeting-capture/title";

/** The body of the Record popover. Under "confirm" Start waits for the box; under "remind" one line asks the person to tell everyone. */
export function RecordForm({
  policy,
  tabAudioAvailable = false,
  systemAudio = false,
  busy = false,
  error,
  onStart,
}: {
  policy: "remind" | "confirm";
  tabAudioAvailable?: boolean;
  /** The desktop app records call audio without a picker: the box reads "Record call audio" and starts checked. */
  systemAudio?: boolean;
  busy?: boolean;
  error?: string;
  onStart: (options: StartOptions) => void;
}) {
  const { t } = useLingui();
  const [title, setTitle] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [tabAudio, setTabAudio] = useState(systemAudio);
  const titleId = useId();
  const agreedId = useId();
  const tabId = useId();
  const confirm = policy === "confirm";
  const placeholder = defaultMeetingTitle(new Date());
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        onStart({
          title: title.trim() ? title : placeholder,
          tabAudio,
          ...(confirm ? { consentConfirmed: true } : {}),
        });
      }}
    >
      <label htmlFor={titleId} className="text-sm font-medium">
        <Trans>Title</Trans>
      </label>
      <Input
        id={titleId}
        value={title}
        maxLength={500}
        placeholder={placeholder}
        onChange={(event) => setTitle(event.target.value)}
      />
      {confirm ? (
        <div className="flex items-center gap-2 py-1">
          <Checkbox
            id={agreedId}
            checked={agreed}
            onCheckedChange={(on) => setAgreed(on === true)}
          />
          <label htmlFor={agreedId} className="text-sm">
            <Trans>Everyone agreed to be recorded</Trans>
          </label>
        </div>
      ) : (
        <p className="py-1 text-sm text-muted-foreground">
          <Trans>Tell everyone you're recording.</Trans>
        </p>
      )}
      {tabAudioAvailable ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={tabId}
            checked={tabAudio}
            onCheckedChange={(on) => setTabAudio(on === true)}
          />
          <label htmlFor={tabId} className="text-sm">
            {systemAudio ? (
              <Trans>Record call audio</Trans>
            ) : (
              <Trans>Also record a browser tab</Trans>
            )}
          </label>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || (confirm && !agreed)} aria-label={t`Start`}>
        <Trans>Start</Trans>
      </Button>
    </form>
  );
}

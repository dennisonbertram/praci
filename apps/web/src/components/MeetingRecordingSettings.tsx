import { Trans, useLingui } from "@lingui/react/macro";
import type { MeetingRecordingPolicy } from "@rakazo/contracts";
import { NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** Whether meetings may be recorded in this space. Only owners and admins see it. */
export function MeetingRecordingSettings() {
  const { t } = useLingui();
  const [policy, setPolicy] = useState<MeetingRecordingPolicy | null>(null);
  const [canSet, setCanSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc.spaces
      .list()
      .then(({ current, spaces }) => {
        const space = spaces.find((item) => item.id === current.id);
        setPolicy(space?.meetingRecording ?? "remind");
        setCanSet(space?.canSetMeetingRecording === true);
      })
      .catch(() => undefined);
  }, []);

  if (!policy || !canSet) return null;

  async function choose(next: MeetingRecordingPolicy) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      setPolicy((await rpc.spaces.setMeetingRecording({ policy: next })).policy);
    } catch (cause) {
      setError(errorText(cause, t`Could not save the recording setting`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-testid="meeting-recording-settings"
      className="rounded-xl border border-border px-4 py-4"
    >
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Meeting recording</Trans>
      </h3>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <label htmlFor="meeting-recording" className="text-[14px] text-foreground/75">
          <Trans>Recording</Trans>
        </label>
        <NativeSelect
          id="meeting-recording"
          size="sm"
          disabled={saving}
          value={policy}
          onChange={(event) => void choose(event.target.value as MeetingRecordingPolicy)}
        >
          <NativeSelectOption value="remind">{t`Remind`}</NativeSelectOption>
          <NativeSelectOption value="confirm">{t`Confirm`}</NativeSelectOption>
          <NativeSelectOption value="off">{t`Off`}</NativeSelectOption>
        </NativeSelect>
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {policy === "remind" ? (
          <Trans>Shows “Tell everyone you're recording.” before each recording.</Trans>
        ) : policy === "confirm" ? (
          <Trans>Each recording needs “Everyone agreed to be recorded” to be ticked.</Trans>
        ) : (
          <Trans>No one can record meetings in this space.</Trans>
        )}
      </p>
      {error ? <p className="mt-2 text-[13px] text-destructive">{error}</p> : null}
    </section>
  );
}

import { Trans, useLingui } from "@lingui/react/macro";
import { Label, Switch } from "@rakazo/ui-web";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** Whether new mail attachments are filed into the Data room automatically. Saved on change; shown in the Email import dialog. */
export function AutoFileEmailSetting() {
  const { t } = useLingui();
  const id = useId();
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    rpc.models
      .autoFileEmail()
      .then((result) => {
        if (!live) return;
        setEnabled(result.enabled);
        setLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function change(next: boolean) {
    setFailed(null);
    try {
      setEnabled((await rpc.models.setAutoFileEmail({ enabled: next })).enabled);
    } catch (err) {
      setFailed(errorText(err, t`Could not save the setting`));
    }
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <Switch
          id={id}
          className="mt-0.5"
          checked={enabled}
          disabled={!loaded}
          onCheckedChange={(checked) => void change(checked)}
        />
        <Label htmlFor={id} className="text-[14px] font-normal text-foreground/75">
          <Trans>Add new email attachments automatically</Trans>
        </Label>
      </div>
      {failed ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {failed}
        </p>
      ) : null}
    </div>
  );
}

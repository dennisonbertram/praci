import { Trans, useLingui } from "@lingui/react/macro";
import type { ActionAutoReviewRecent, ActionAutoReviewSettings } from "@rakazo/contracts";
import { toolStepLabel } from "@rakazo/core";
import { Label, Switch } from "@rakazo/ui-web";
import { useEffect, useId, useState } from "react";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** Auto Review on or off, whether it also covers background runs, and what it recently passed there. */
export function AutoReviewSettings() {
  const { t } = useLingui();
  const id = useId();
  const [settings, setSettings] = useState<ActionAutoReviewSettings | null>(null);
  const [recent, setRecent] = useState<ActionAutoReviewRecent[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    rpc.autoReview
      .get()
      .then((result) => live && setSettings(result))
      .catch(() => undefined);
    rpc.autoReview
      .recent()
      .then((rows) => live && setRecent(rows))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function change(patch: { enabled?: boolean; background?: boolean }) {
    setFailed(null);
    try {
      setSettings(await rpc.autoReview.set(patch));
    } catch (err) {
      setFailed(errorText(err, t`Could not save the setting`));
    }
  }

  return (
    <div className="space-y-3" data-testid="auto-review-settings">
      <div className="flex items-start gap-3">
        <Switch
          id={id}
          className="mt-0.5"
          checked={settings?.enabled ?? false}
          disabled={!settings}
          onCheckedChange={(checked) => void change({ enabled: checked })}
        />
        <Label htmlFor={id} className="text-[14px] font-normal text-foreground/75">
          <Trans>Auto Review</Trans>
        </Label>
      </div>
      {settings?.enabled ? (
        <div className="flex items-start gap-3">
          <Switch
            id={`${id}-background`}
            className="mt-0.5"
            checked={settings.background}
            onCheckedChange={(checked) => void change({ background: checked })}
          />
          <Label
            htmlFor={`${id}-background`}
            className="text-[14px] font-normal text-foreground/75"
          >
            <Trans>Also in background runs</Trans>
          </Label>
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {failed}
        </p>
      ) : null}
      {recent.length > 0 ? (
        <div>
          <h4 className="text-[13px] font-medium text-foreground">
            <Trans>Recently approved by Auto Review</Trans>
          </h4>
          <ul className="mt-2 space-y-1.5">
            {recent.map((item) => (
              <li key={item.id} className="text-[13px] text-foreground/75">
                {toolStepLabel(item.tool)}
                <span className="block text-[12px] text-muted-foreground">
                  {formatRelativeTime(item.at)} · {item.botName}
                  {item.reason ? ` · ${item.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

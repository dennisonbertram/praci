import { useLingui } from "@lingui/react/macro";
import type { PermissionLevel, PermissionSettings } from "@rakazo/contracts";
import { PermissionLevelSchema } from "@rakazo/contracts";
import { clampPermissionLevel } from "@rakazo/core";
import { Button, NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const LEVELS = PermissionLevelSchema.options;

export type AgentPermission = {
  /** The agent's own level; null follows the space. */
  level: PermissionLevel | null;
  /** Firewalled and external agents: shown at their effective level, not editable. */
  clamped: boolean;
  onChange: (level: PermissionLevel | null) => void;
};

/** The space's permission level ("Default (…)" first, which saves null), or with `agent` that agent's override ("Same as space" first). */
export function PermissionLevelSelect({
  agent,
  onSaved,
  onLevel,
}: {
  agent?: AgentPermission;
  /** Fires after the space's level was saved; the approvals table reloads on it. */
  onSaved?: () => void;
  /** Reports the space's resolved level when it loads and after each save; the rules list shows the gate's effect on it. */
  onLevel?: (level: PermissionLevel) => void;
}) {
  const { t } = useLingui();
  const id = useId();
  const [settings, setSettings] = useState<PermissionSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [loadFailed, setLoadFailed] = useState(false);
  const needsSpaceSettings = !agent || agent.clamped;

  useEffect(() => {
    // An editable agent can be changed independently; inheriting from the space is
    // represented by null and does not need the space's settings read.
    if (loadFailed || !needsSpaceSettings) return;
    rpc.permissions
      .get()
      .then((loaded) => {
        setSettings(loaded);
        onLevel?.(loaded.level ?? loaded.effectiveDefault);
      })
      .catch((err) => {
        setError(errorText(err, t`Could not load permissions`));
        setLoadFailed(true);
      });
  }, [t, loadFailed, onLevel, needsSpaceSettings]);

  const labels: Record<PermissionLevel, string> = {
    open: t`Open`,
    ask_changes: t`Ask for changes`,
    ask_everything: t`Ask for everything`,
  };
  const spaceLevel = settings ? (settings.level ?? settings.effectiveDefault) : null;

  async function change(value: string) {
    const level = value === "" ? null : (value as PermissionLevel);
    if (agent) return agent.onChange(level);
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await rpc.permissions.set({ level });
      setSettings(saved);
      onLevel?.(saved.level ?? saved.effectiveDefault);
      onSaved?.();
    } catch (err) {
      setError(errorText(err, t`Could not save permissions`));
    } finally {
      setSaving(false);
    }
  }

  const shown = !agent
    ? (settings?.level ?? null)
    : agent.clamped
      ? clampPermissionLevel(agent.level ?? spaceLevel ?? "ask_changes")
      : agent.level;
  const levels = agent?.clamped ? LEVELS.filter((level) => level !== "open") : LEVELS;

  return (
    <div data-testid={agent ? "bot-permission-level" : "permission-level"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-medium text-foreground">
          {t`Permissions`}
        </label>
        <NativeSelect
          id={id}
          className="w-44"
          value={shown ?? ""}
          disabled={(needsSpaceSettings && !settings) || agent?.clamped || saving}
          onChange={(event) => void change(event.target.value)}
        >
          {agent && !agent.clamped ? (
            <NativeSelectOption value="">{t`Same as space`}</NativeSelectOption>
          ) : null}
          {!agent && settings ? (
            <NativeSelectOption value="">
              {t`Default (${labels[settings.effectiveDefault]})`}
            </NativeSelectOption>
          ) : null}
          {levels.map((level) => (
            <NativeSelectOption key={level} value={level}>
              {labels[level]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {!agent && spaceLevel === "open" ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          {t`Sending to new people, payments, permanent deletes and access requests always ask.`}
        </p>
      ) : null}
      {error && needsSpaceSettings ? (
        <p className="mt-2 text-[13px] text-destructive">{error}</p>
      ) : null}
      {loadFailed && needsSpaceSettings ? (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            setError(null);
            setLoadFailed(false);
          }}
        >
          {t`Retry`}
        </Button>
      ) : null}
    </div>
  );
}

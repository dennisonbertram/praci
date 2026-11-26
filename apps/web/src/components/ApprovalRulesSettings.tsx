import { Trans, useLingui } from "@lingui/react/macro";
import type { ActionApprovalRule, ApprovalChoice, PermissionLevel } from "@rakazo/contracts";
import {
  actionTypeForTool,
  CHOICE_TO_EFFECT,
  EFFECT_TO_CHOICE,
  toolRuleAllowsAllow,
  toolStepLabel,
} from "@rakazo/core";
import { Button, NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { ApprovalActionsTable, useActionTypeLabels } from "./ApprovalActionsTable";
import { PermissionLevelSelect } from "./PermissionLevelSelect";

export function ApprovalRulesSettings() {
  const { t } = useLingui();
  const labels = useActionTypeLabels();
  const [rules, setRules] = useState<ActionApprovalRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  // Bumped when the permission level is saved, so the table reloads its rows.
  const [levelVersion, setLevelVersion] = useState(0);
  // The space's resolved level, reported by the picker; the rules list shows the gate's effect at it.
  const [spaceLevel, setSpaceLevel] = useState<PermissionLevel | null>(null);
  // The last removed rule, offered back inline: Settings is a dialog, where toasts are hidden.
  const undoing = useRef(false);
  const [removed, setRemoved] = useState<{ rule: ActionApprovalRule; title: string } | null>(null);

  useEffect(() => {
    rpc.approvalRules
      .list()
      .then(setRules)
      .catch((err) => setError(errorText(err, t`Could not load approval rules`)));
  }, [t]);

  async function changeRule(rule: ActionApprovalRule, choice: ApprovalChoice) {
    if (saving) return;
    setSaving(rule.id);
    setError(null);
    try {
      const saved = await rpc.approvalRules.set({
        effect: CHOICE_TO_EFFECT[choice],
        matchKind: rule.matchKind,
        matchValue: rule.matchValue,
      });
      setRules((current) => current.map((item) => (item.id === rule.id ? saved : item)));
    } catch (err) {
      setError(errorText(err, t`Could not save rule`));
    } finally {
      setSaving(null);
    }
  }

  async function removeRule(rule: ActionApprovalRule, title: string) {
    if (saving) return;
    setSaving(rule.id);
    setError(null);
    try {
      await rpc.approvalRules.remove({ id: rule.id });
      setRules((current) => current.filter((item) => item.id !== rule.id));
      setRemoved({ rule, title });
    } catch (err) {
      setError(errorText(err, t`Could not remove rule`));
    } finally {
      setSaving(null);
    }
  }

  async function undoRemove(rule: ActionApprovalRule) {
    // A second click before the notice is gone must not restore the rule twice.
    if (undoing.current) return;
    undoing.current = true;
    setRemoved(null);
    setError(null);
    try {
      const saved = await rpc.approvalRules.set({
        effect: rule.effect,
        matchKind: rule.matchKind,
        matchValue: rule.matchValue,
        botId: rule.botId ?? undefined,
      });
      // set returns the rule without the joined names; keep the ones the row showed.
      const same = (item: ActionApprovalRule) =>
        item.matchKind === rule.matchKind &&
        item.matchValue === rule.matchValue &&
        (item.botId ?? null) === (rule.botId ?? null) &&
        !item.routineId;
      setRules((current) => [
        ...current.filter((item) => !same(item)),
        {
          ...saved,
          botName: saved.botName ?? rule.botName,
          routineName: saved.routineName ?? rule.routineName,
        },
      ]);
    } catch (err) {
      setError(errorText(err, t`Could not save rule`));
    } finally {
      undoing.current = false;
    }
  }

  // Named `title` so the shared "Removed {title}" message is reused.
  const title = removed?.title ?? "";
  const removedText = t`Removed ${title}`;

  // The table owns category rules and bot overrides; the list holds the per-tool and per-connector rules.
  const listedRules = rules.filter(
    (rule) => rule.matchKind !== "category" && !rule.botId && !rule.routineId,
  );
  // An agent's "Allow all sites" rule: the owner can only remove it.
  const routineRules = rules.filter((rule) => rule.routineId);
  const agentSiteRules = rules.filter(
    (rule) => rule.botId && rule.matchKind === "tool" && rule.matchValue === "web_fetch",
  );

  return (
    <div data-testid="action-confirmation-settings">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Approvals</Trans>
      </h3>
      <div className="mt-3">
        <PermissionLevelSelect
          onSaved={() => setLevelVersion((n) => n + 1)}
          onLevel={setSpaceLevel}
        />
      </div>
      {error ? <p className="mt-3 text-[13px] text-destructive">{error}</p> : null}
      {removed ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
          <span className="min-w-0 break-words">{removedText}</span>
          {removed.rule.routineId ? null : (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[13px] text-foreground"
              onClick={() => void undoRemove(removed.rule)}
            >
              {t`Undo`}
            </Button>
          )}
        </p>
      ) : null}
      <details className="group mt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 py-1.5 text-[13px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-90"
          />
          <Trans>Customize actions</Trans>
        </summary>
        <div className="mt-2">
          <ApprovalActionsTable refreshKey={levelVersion} showMoreActionsDisclosure={false} />
        </div>
        {routineRules.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {routineRules.map((rule) => (
              <RuleRow
                key={rule.id}
                title={toolStepLabel(rule.matchValue)}
                subtitle={rule.routineName ?? t`A routine`}
                disabled={saving === rule.id}
                onRemove={() => void removeRule(rule, toolStepLabel(rule.matchValue))}
              />
            ))}
          </ul>
        ) : null}
        {agentSiteRules.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {agentSiteRules.map((rule) => (
              <RuleRow
                key={rule.id}
                title={rule.botName ?? t`An agent`}
                subtitle={<Trans>Fetches any site</Trans>}
                disabled={saving === rule.id}
                onRemove={() => void removeRule(rule, rule.botName ?? t`An agent`)}
              />
            ))}
          </ul>
        ) : null}
        {listedRules.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {listedRules.map((rule) => {
              const type =
                rule.matchKind === "tool" ? actionTypeForTool({ toolName: rule.matchValue }) : null;
              const name =
                rule.matchKind === "tool" ? toolStepLabel(rule.matchValue) : rule.matchValue;
              const subtitle = type ? labels[type] : undefined;
              const choice = EFFECT_TO_CHOICE[rule.effect];
              return (
                <RuleRow
                  key={rule.id}
                  title={name}
                  subtitle={subtitle}
                  titleAttr={rule.matchValue}
                  disabled={saving === rule.id}
                  onRemove={() => void removeRule(rule, name)}
                  control={
                    <NativeSelect
                      size="sm"
                      aria-label={name}
                      disabled={saving === rule.id}
                      value={choice}
                      onChange={(event) =>
                        void changeRule(rule, event.target.value as ApprovalChoice)
                      }
                    >
                      <NativeSelectOption
                        value="allow"
                        disabled={
                          spaceLevel === "ask_everything" ||
                          (rule.matchKind === "tool" && !toolRuleAllowsAllow(rule.matchValue))
                        }
                      >
                        {t`Allow`}
                      </NativeSelectOption>
                      <NativeSelectOption value="ask">{t`Ask`}</NativeSelectOption>
                      <NativeSelectOption value="block">{t`Block`}</NativeSelectOption>
                    </NativeSelect>
                  }
                />
              );
            })}
          </ul>
        ) : null}
      </details>
    </div>
  );
}

function RuleRow({
  title,
  subtitle,
  titleAttr,
  control,
  onRemove,
  disabled,
}: {
  title: string;
  subtitle?: React.ReactNode;
  titleAttr?: string;
  control?: React.ReactNode;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2">
      <span className="min-w-0 break-words text-[13.5px] text-foreground/75" title={titleAttr}>
        {title}
        {subtitle ? (
          <span className="block text-[12px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {control}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trans>Remove</Trans>
        </Button>
      </span>
    </li>
  );
}

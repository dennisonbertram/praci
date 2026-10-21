import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ActionApprovalRule, ActionAutoReviewSettings } from "@rakazo/contracts";
import { Button, Label, Switch } from "@rakazo/ui-web";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

function describeRule(rule: ActionApprovalRule): string {
  if (rule.effect === "require_approval") {
    if (rule.matchKind === "category") {
      if (rule.matchValue === "email") return t`Ask before email actions`;
      if (rule.matchValue === "purchase") return t`Ask before purchase actions`;
      return t`Ask before ${rule.matchValue} actions`;
    }
    if (rule.matchKind === "connector") return t`Ask before ${rule.matchValue} connector`;
    return t`Ask before ${rule.matchValue}`;
  }
  if (rule.matchKind === "category") {
    if (rule.matchValue === "email") return t`Allow email actions without asking`;
    if (rule.matchValue === "purchase") return t`Allow purchase actions without asking`;
    return t`Allow ${rule.matchValue} actions without asking`;
  }
  if (rule.matchKind === "connector") return t`Allow ${rule.matchValue} connector without asking`;
  return t`Allow ${rule.matchValue} without asking`;
}

export function ApprovalRulesSettings() {
  const { t } = useLingui();
  const autoReviewId = useId();
  const emailId = useId();
  const purchaseId = useId();
  const [rules, setRules] = useState<ActionApprovalRule[]>([]);
  const [autoReview, setAutoReview] = useState<ActionAutoReviewSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPreset, setSavingPreset] = useState<"email" | "purchase" | null>(null);
  const [savingAutoReview, setSavingAutoReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [nextRules, nextAutoReview] = await Promise.all([
        rpc.approvalRules.list(),
        rpc.autoReview.get(),
      ]);
      setRules(nextRules);
      setAutoReview(nextAutoReview);
    } catch (err) {
      setError(errorText(err, t`Could not load approval rules`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const presetRule = (matchValue: "email" | "purchase") =>
    rules.find(
      (rule) =>
        rule.effect === "require_approval" &&
        rule.matchKind === "category" &&
        rule.matchValue === matchValue,
    );

  async function setPreset(matchValue: "email" | "purchase", on: boolean) {
    if (loading || savingPreset) return;
    const existing = presetRule(matchValue);
    setSavingPreset(matchValue);
    setError(null);
    try {
      if (!on) {
        if (existing) {
          await rpc.approvalRules.remove({ id: existing.id });
          setRules((current) => current.filter((rule) => rule.id !== existing.id));
        }
      } else if (!existing) {
        const saved = await rpc.approvalRules.set({
          effect: "require_approval",
          matchKind: "category",
          matchValue,
        });
        setRules((current) => [...current, saved]);
      }
    } catch (err) {
      setError(errorText(err, on ? t`Could not save rule` : t`Could not remove rule`));
    } finally {
      setSavingPreset(null);
    }
  }

  async function removeRule(id: string) {
    setError(null);
    try {
      await rpc.approvalRules.remove({ id });
      setRules((current) => current.filter((rule) => rule.id !== id));
    } catch (err) {
      setError(errorText(err, t`Could not remove rule`));
    }
  }

  async function toggleAutoReview(enabled: boolean) {
    if (loading || savingAutoReview) return;
    setSavingAutoReview(true);
    setError(null);
    try {
      setAutoReview(await rpc.autoReview.set({ enabled }));
    } catch (err) {
      setError(errorText(err, t`Could not save Auto Review`));
    } finally {
      setSavingAutoReview(false);
    }
  }

  // The two switches show their own rules; the list holds the rest.
  const shown = [presetRule("email"), presetRule("purchase")];
  const listedRules = rules.filter((rule) => !shown.includes(rule));

  return (
    <div data-testid="action-confirmation-settings">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Action confirmations</Trans>
      </h3>
      <div className="mt-4 flex flex-col gap-3">
        {(
          [
            ["email", emailId, t`Ask before sending external email`],
            ["purchase", purchaseId, t`Ask before purchases`],
          ] as const
        ).map(([kind, id, label]) => (
          <div key={kind} className="flex items-start gap-3">
            <Switch
              id={id}
              data-testid={`approval-preset-${kind}`}
              className="mt-0.5"
              checked={presetRule(kind) !== undefined}
              disabled={loading || savingPreset !== null}
              onCheckedChange={(checked) => void setPreset(kind, checked)}
            />
            <Label htmlFor={id} className="text-[14px] font-normal text-foreground/75">
              {label}
            </Label>
          </div>
        ))}
        <div className="flex items-start gap-3">
          <Switch
            id={autoReviewId}
            data-testid="auto-review-toggle"
            className="mt-0.5"
            checked={autoReview?.enabled ?? false}
            disabled={loading || savingAutoReview || !autoReview}
            onCheckedChange={(checked) => void toggleAutoReview(checked)}
          />
          <div>
            <Label htmlFor={autoReviewId} className="text-[14px] font-normal text-foreground/75">
              <Trans>Flag unexpected actions</Trans>
            </Label>
            {autoReview?.enabled && !autoReview.checkerAvailable ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                <Trans>Add a model in Settings to use this.</Trans>
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {error ? <p className="mt-3 text-[13px] text-destructive">{error}</p> : null}
      {loading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          <Trans>Loading rules…</Trans>
        </p>
      ) : listedRules.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {listedRules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2"
            >
              <span className="text-[13.5px] text-foreground/75">{describeRule(rule)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => void removeRule(rule.id)}
              >
                <Trans>Remove</Trans>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

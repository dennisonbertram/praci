import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChatMarkdown } from "@rakazo/chat-ui/web";
import type { ThreadMessage } from "@rakazo/contracts";
import { commandVariableName } from "@rakazo/contracts";
import { isApprovalAskBlock, isSecretAskBlock, selectedAskActionLabel } from "@rakazo/core";
import { Button, Input } from "@rakazo/ui-web";
import { Check, KeyRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { errorText } from "../lib/user-error";
import { SecretRequestDialog } from "./SecretRequestDialog";

export type AskBlock = Extract<ThreadMessage["blocks"][number], { kind: "ask" }>;

function formatAnsweredState(
  answer: string | undefined,
  approval: boolean,
  secret: boolean,
  outcome?: "created" | "cancelled",
  actions?: AskBlock["actions"],
  consent?: boolean,
  share?: boolean,
): string {
  if (secret) return t`Saved`;
  if (!answer) return t`Answered`;
  if (share && approval) return answer === "allow" ? t`Shared` : t`Not shared`;
  if (consent && approval) return answer === "allow" ? t`Allowed` : t`Not now`;
  if (!approval) return t`Answered: ${selectedAskActionLabel(answer, actions)}`;
  if (outcome === "created") return t`Created`;
  if (outcome === "cancelled") return t`Cancelled`;
  if (answer === "allow") return t`Approved`;
  if (answer === "always") return t`Always allowed`;
  if (answer === "deny") return t`Denied`;
  return t`Answered: ${answer}`;
}

/** Success green is for completed actions; an approval answer only records the choice. */
function answeredTone(
  answer: string | undefined,
  approval: boolean,
  secret: boolean,
  outcome?: "created" | "cancelled",
): { className: string; Icon?: typeof Check } {
  if (secret || outcome === "created") return { className: "text-success" };
  if (!approval || outcome === "cancelled") return { className: "text-muted-foreground" };
  if (answer === "deny") return { className: "text-destructive", Icon: X };
  if (answer === "allow" || answer === "always")
    return { className: "text-foreground", Icon: Check };
  return { className: "text-muted-foreground" };
}

function approvalActionLabel(
  id: string,
  fallback: string,
  outcome?: "created" | "cancelled",
  consent?: boolean,
  share?: boolean,
): string {
  if (share && id === "allow") return t`Share`;
  if (share && id === "deny") return t`Don't share`;
  if (consent && id === "allow") return t`Allow`;
  if (consent && id === "deny") return t`Not now`;
  if (outcome === "created") return t`Create space`;
  if (outcome === "cancelled") return t`Cancel`;
  // A payment's label already carries the amount ("Send $300.00"): keep it.
  if (id === "allow")
    return fallback.startsWith("Send ") ? maskCurrencyWhenHidden(fallback) : t`Allow once`;
  if (id === "always") return t`Always allow this`;
  if (id === "deny") return t`Deny`;
  return fallback;
}

function secretFieldLabel(purpose: AskBlock["purpose"]): string {
  if (purpose === "password") return t`Password`;
  if (purpose === "api_key") return t`API key`;
  return t`Code`;
}

export function AskCard({
  block,
  canAnswer,
  onAnswer,
}: {
  block: AskBlock;
  canAnswer: boolean;
  onAnswer: (text: string, username?: string) => Promise<void>;
}) {
  const { t } = useLingui();
  // Re-render when Hide amounts changes: a payment button carries its amount.
  useHideAmounts();
  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionId = useId();
  const answeredHere = useRef(false);
  const submitting = pendingAction !== null;
  const approvalActions = isApprovalAskBlock(block) ? block.actions : undefined;
  const askActions = block.actions;
  const secretInput = isSecretAskBlock(block);
  const loginInput = secretInput && block.credential?.auth.type === "login";
  const secretLabel = loginInput ? t`Password` : secretFieldLabel(block.purpose);
  const secretName = block.credential
    ? block.credential.auth.type === "command"
      ? commandVariableName(block.credential.name)
      : block.credential.name
    : secretLabel;

  // The answer lands in the thread a moment after the click, and the re-render can drop focus to
  // the page. Put it back on the composer, but only for a card this reader just answered.
  useEffect(() => {
    if (block.status !== "answered" || !answeredHere.current) return;
    answeredHere.current = false;
    if (document.activeElement && document.activeElement !== document.body) return;
    document.querySelector<HTMLElement>("[data-composer-input]")?.focus();
  }, [block.status]);

  async function submitAnswer(value: string, secretUsername?: string) {
    if (submitting) return;
    if (secretInput ? value.length === 0 : !value.trim()) return;
    const submitUsername = loginInput ? secretUsername?.trim() : undefined;
    if (loginInput && !submitUsername) return;
    const submitValue = secretInput ? value : value.trim();
    setPendingAction(secretInput ? "submit" : submitValue);
    setError(null);
    if (secretInput) {
      setDialogOpen(false);
    }
    try {
      await onAnswer(submitValue, submitUsername);
      answeredHere.current = true;
      // The card's buttons vanish with the answer; keep the keyboard in the conversation.
      if (!secretInput) document.querySelector<HTMLElement>("[data-composer-input]")?.focus();
    } catch (err) {
      // A secret answer's failure may echo the secret, so never show its message.
      setError(
        secretInput
          ? t`Could not submit this answer`
          : errorText(err, t`Could not submit this answer`),
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset brings its own border and sizing to a card
    <div
      role="group"
      aria-labelledby={questionId}
      data-testid={secretInput ? "secret-ask-card" : undefined}
      className="w-160 max-w-full rounded-2xl border border-border bg-card px-5 py-4"
    >
      {secretInput && block.status !== "answered" && canAnswer ? (
        <div className="mb-3 flex items-center gap-2 text-[13.5px] font-medium text-foreground">
          <KeyRound aria-hidden className="size-4 text-muted-foreground" />
          <span>
            <Trans>Credentials requested:</Trans> <span className="font-mono">{secretName}</span>
          </span>
        </div>
      ) : null}
      <div id={questionId} className="text-[15.5px] leading-[1.5] text-foreground">
        <ChatMarkdown>{block.text}</ChatMarkdown>
      </div>
      {secretInput && block.credential ? (
        <div
          data-testid="secret-ask-destination"
          className="mt-2 break-all text-[13px] text-muted-foreground"
        >
          {block.credential.auth.type === "command"
            ? `${t`Command variable`} · $${commandVariableName(block.credential.name)}`
            : block.credential.origin}
        </div>
      ) : null}
      {block.detail && block.consent ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{block.detail}</p>
      ) : block.detail && !secretInput && block.detailFolded ? (
        <details className="mt-3 text-[13px] text-muted-foreground">
          <summary className="w-fit cursor-pointer">
            <Trans>Details</Trans>
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted px-3.5 py-3 font-mono text-[12.5px] leading-[1.7]">
            {block.detail.trim()}
          </pre>
        </details>
      ) : block.detail && !secretInput ? (
        <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-muted-foreground">
          {block.detail.trim()}
        </p>
      ) : null}
      {block.status === "answered" ? (
        (() => {
          const outcome = approvalActions?.find((action) => action.id === block.answer)?.outcome;
          const { className, Icon } = answeredTone(
            block.answer,
            Boolean(approvalActions),
            secretInput,
            outcome,
          );
          return (
            <div
              className={`mt-3.5 flex items-center gap-1.5 text-[13.5px] font-medium ${className}`}
            >
              {Icon ? <Icon aria-hidden className="size-4" /> : null}
              {formatAnsweredState(
                block.answer,
                Boolean(approvalActions),
                secretInput,
                outcome,
                askActions,
                Boolean(block.consent),
                Boolean(block.share),
              )}
            </div>
          );
        })()
      ) : !canAnswer ? (
        <div className="mt-3.5 text-[13.5px] font-medium text-muted-foreground">
          <Trans>No longer active</Trans>
        </div>
      ) : askActions?.length ? (
        <div className="mt-3.5 space-y-1.5">
          {[...askActions]
            .sort(
              (a, b) =>
                Number(approvalActions && a.id === "always") -
                Number(approvalActions && b.id === "always"),
            )
            .map((action) =>
              // A standing permission is a quiet text action under the one-off answers.
              approvalActions && action.id === "always" ? (
                <div key={action.id} className="flex flex-wrap items-baseline gap-x-2 px-1 pt-1">
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    disabled={submitting}
                    onClick={() => void submitAnswer(action.id)}
                  >
                    {pendingAction === action.id ? (
                      <Trans>Sending…</Trans>
                    ) : (
                      approvalActionLabel(action.id, action.label)
                    )}
                  </Button>
                  <span className="text-[13px] text-muted-foreground">
                    <Trans>Won't ask again for this kind of action.</Trans>
                  </span>
                </div>
              ) : (
                <Button
                  key={action.id}
                  variant={approvalActions && action.id === "allow" ? "default" : "outline"}
                  className="h-auto w-full justify-start whitespace-normal px-3.5 py-3 text-start font-normal"
                  disabled={submitting}
                  onClick={() => void submitAnswer(action.id)}
                >
                  {pendingAction === action.id ? (
                    <Trans>Sending…</Trans>
                  ) : approvalActions ? (
                    approvalActionLabel(
                      action.id,
                      action.label,
                      action.outcome,
                      Boolean(block.consent),
                      Boolean(block.share),
                    )
                  ) : (
                    action.label
                  )}
                </Button>
              ),
            )}
        </div>
      ) : secretInput ? (
        <div className="mt-3.5 border-t border-border pt-3.5">
          <Button disabled={submitting} onClick={() => setDialogOpen(true)}>
            {submitting ? <Trans>Saving…</Trans> : <Trans>Provide secret</Trans>}
          </Button>
          <SecretRequestDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            name={secretName}
            description={block.text}
            login={loginInput}
            onSubmit={(value, user) => {
              void submitAnswer(value, user);
            }}
          />
        </div>
      ) : editing ? (
        <form
          className="mt-3.5 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswer(answer);
          }}
        >
          <Input
            aria-label={t`Answer`}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={t`Type your answer`}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={!answer.trim() || submitting}>
              {submitting ? <Trans>Sending…</Trans> : <Trans>Send answer</Trans>}
            </Button>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setAnswer("");
                setEditing(false);
              }}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3.5 flex gap-2">
          <Button disabled={submitting} onClick={() => void submitAnswer("approved")}>
            {submitting ? <Trans>Sending…</Trans> : <Trans>Send it</Trans>}
          </Button>
          <Button variant="outline" disabled={submitting} onClick={() => setEditing(true)}>
            <Trans>Edit first</Trans>
          </Button>
        </div>
      )}
      {error ? <p className="mt-3 text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}

import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import type { AiConsentStatus, AiRecipient } from "@rakazo/contracts";
import { AI_DATA_DISCLOSURES } from "@rakazo/contracts";
import { Button, Card, cn, Skeleton, Switch } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { aiConsentStatus, allowRecipient, revokeRecipient } from "../lib/ai-consent";
import { INBOX_CHANGED_EVENT } from "../lib/inbox-message-cache";
import { errorText } from "../lib/user-error";

/** The one card that asks for AI data sharing, in one row: what Praci would read, a sentence, Allow. */
export function ConsentCard({
  id,
  heading,
  onAllow,
  onDismiss,
  sends,
  className,
}: {
  /** Prefix for the heading's id, unique on the page. */
  id: string;
  /** Names the area, e.g. "Let Praci sort your mail". */
  heading: ReactNode;
  /** Rejects with the reason to show. */
  onAllow: () => Promise<unknown>;
  /** Not now: when given, a second button hides the card for this visit. */
  onDismiss?: () => void;
  /** What is sent, when the area sends something narrower than "the text". */
  sends?: ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const allow = () => {
    setPending(true);
    setError("");
    onAllow()
      .catch((cause) => setError(errorText(cause)))
      .finally(() => setPending(false));
  };
  return (
    <Card
      size="sm"
      role="region"
      className={cn("flex-row flex-wrap items-center gap-x-3 gap-y-1 px-3.5", className)}
      aria-labelledby={`${id}-heading`}
    >
      <div className="flex min-w-0 flex-1 basis-64 flex-col">
        <h2 id={`${id}-heading`} className="text-sm font-medium">
          {heading}
        </h2>
        <p className="text-xs text-muted-foreground">
          {sends ?? <Trans>The text is sent to the AI model that runs your bots.</Trans>}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={allow}>
          <Trans>Allow</Trans>
        </Button>
        {onDismiss ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={onDismiss}>
            <Trans>Not now</Trans>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="basis-full text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

/** Asks once for the model that would sort the Inbox; the one button grants exactly that recipient. */
export function InboxConsentPrompt({
  recipient,
  onAllowed,
  onDismiss,
}: {
  recipient: { key: string; name: string };
  onAllowed: () => void;
  /** Not now: hides the prompt for this visit; it shows again next time. */
  onDismiss?: () => void;
}) {
  return (
    <ConsentCard
      id="inbox-consent"
      className="mb-5"
      heading={<Trans>Let Praci sort your mail</Trans>}
      sends={
        <Trans>
          The sender, subject and a preview of each message are sent to the AI model that runs your
          bots.
        </Trans>
      }
      onAllow={() => allowRecipient(recipient.key).then(onAllowed)}
      onDismiss={onDismiss}
    />
  );
}

/** "vendor/gpt-6-luna, forwarded to its provider" -> "gpt-6-luna". */
const modelLabel = (detail: string) => detail.split(",")[0]?.split("/").pop()?.trim() ?? "";

/** One switch per AI model that receives data; hidden when there is none or it cannot load. */
export function AiDataSharingSection() {
  const { t } = useLingui();
  // null until the first read, so the section holds its place instead of appearing late.
  const [recipients, setRecipients] = useState<AiRecipient[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const show = (status: AiConsentStatus) =>
    setRecipients(status.recipients.filter((recipient) => recipient.use === "model"));
  useEffect(() => {
    let live = true;
    aiConsentStatus()
      .then((status) => live && show(status))
      .catch(() => live && setRecipients([]));
    return () => {
      live = false;
    };
  }, []);

  if (recipients === null) return <Skeleton aria-busy="true" className="h-[132px] rounded-xl" />;
  if (recipients.length === 0) return null;
  const set = (recipient: AiRecipient, allowed: boolean) => {
    setPending(true);
    setError("");
    (allowed ? allowRecipient(recipient.key) : revokeRecipient(recipient.key))
      .then((status) => {
        show(status);
        // An open Inbox reloads, so its sorting and the consent prompt match the switch.
        window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
      })
      .catch((cause) => setError(errorText(cause)))
      .finally(() => setPending(false));
  };
  return (
    <section className="rounded-xl border border-border px-4 py-4">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>AI data sharing</Trans>
      </h3>
      <p className="mt-1 text-[13px] text-muted-foreground">{i18n._(AI_DATA_DISCLOSURES.model)}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        <Trans>Bots cannot use a model until you allow it.</Trans>
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        {recipients.map((recipient) => {
          const model = modelLabel(recipient.detail) || recipient.name;
          return (
            <li key={recipient.key} className="flex items-center gap-3">
              <Switch
                aria-label={t`Allow ${model}`}
                checked={recipient.allowed}
                disabled={pending}
                onCheckedChange={(allowed) => set(recipient, allowed)}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] text-foreground/75">
                  <Trans>Bots, mail, files and contracts</Trans>
                </span>
                <span className="text-[12.5px] text-muted-foreground">{model}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

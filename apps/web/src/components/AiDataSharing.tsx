import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import type { AiConsentStatus, AiRecipient } from "@rakazo/contracts";
import { AI_DATA_DISCLOSURES } from "@rakazo/contracts";
import { Button, Card, cn, Switch } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { aiConsentStatus, allowRecipient, revokeRecipient } from "../lib/ai-consent";
import { errorText } from "../lib/user-error";

/** A card that asks once for consent: a heading, what is sent where, and one Allow button. */
export function ConsentCard({
  id,
  heading,
  children,
  onAllow,
  className,
}: {
  /** Prefix for the heading's id, unique on the page. */
  id: string;
  heading: ReactNode;
  children: ReactNode;
  /** Rejects with the reason to show. */
  onAllow: () => Promise<unknown>;
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
      className={cn("gap-1 px-3.5", className)}
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="text-sm font-medium">
        {heading}
      </h2>
      <p className="text-xs text-muted-foreground">{children}</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button size="sm" disabled={pending} onClick={allow}>
          <Trans>Allow</Trans>
        </Button>
      </div>
    </Card>
  );
}

/** Asks once for the model that would sort the Inbox; the one button grants exactly that recipient. */
export function InboxConsentPrompt({
  recipient,
  onAllowed,
}: {
  recipient: { key: string; name: string };
  onAllowed: () => void;
}) {
  const { name } = recipient;
  return (
    <ConsentCard
      id="inbox-consent"
      className="mb-5"
      heading={<Trans>Let Rakazo sort your mail</Trans>}
      onAllow={() => allowRecipient(recipient.key).then(onAllowed)}
    >
      <Trans>Senders, recipients, subjects and short previews are sent to {name}.</Trans>
    </ConsentCard>
  );
}

/** One switch per AI model that receives data; hidden when there is none or it cannot load. */
export function AiDataSharingSection() {
  const { t } = useLingui();
  const [recipients, setRecipients] = useState<AiRecipient[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const show = (status: AiConsentStatus) =>
    setRecipients(status.recipients.filter((recipient) => recipient.use === "model"));
  useEffect(() => {
    let live = true;
    aiConsentStatus()
      .then((status) => live && show(status))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (recipients.length === 0) return null;
  const set = (recipient: AiRecipient, allowed: boolean) => {
    setPending(true);
    setError("");
    (allowed ? allowRecipient(recipient.key) : revokeRecipient(recipient.key))
      .then(show)
      .catch((cause) => setError(errorText(cause)))
      .finally(() => setPending(false));
  };
  return (
    <section className="rounded-xl border border-border px-4 py-4">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>AI data sharing</Trans>
      </h3>
      <p className="mt-1 text-[13px] text-muted-foreground">{i18n._(AI_DATA_DISCLOSURES.model)}</p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        {recipients.map((recipient) => {
          const { name } = recipient;
          return (
            <li key={recipient.key} className="flex items-center gap-3">
              <Switch
                aria-label={t`Allow ${name}`}
                checked={recipient.allowed}
                disabled={pending}
                onCheckedChange={(allowed) => set(recipient, allowed)}
              />
              <span className="text-[14px] text-foreground/75">{name}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

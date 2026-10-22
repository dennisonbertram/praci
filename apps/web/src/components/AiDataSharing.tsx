import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import type { AiConsentStatus, AiRecipient, DataRoomConsentStatus } from "@rakazo/contracts";
import { AI_DATA_DISCLOSURES, modelLabel } from "@rakazo/contracts";
import { Button, Card, cn, Skeleton, Switch } from "@rakazo/ui-web";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  aiConsentStatus,
  allowDocuments,
  allowRecipient,
  documentConsent,
  revokeRecipient,
} from "../lib/ai-consent";
import { INBOX_CHANGED_EVENT } from "../lib/inbox-message-cache";
import { errorText } from "../lib/user-error";

/** The one card that asks for AI data sharing, in one row: what Praci would read, a sentence, Allow. */
export function ConsentCard({
  id,
  heading,
  onAllow,
  onDismiss,
  sends,
  shownElsewhere,
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
  /** An error the page already shows: the card does not repeat it. */
  shownElsewhere?: string;
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
      {error && error !== shownElsewhere ? (
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
  shownElsewhere,
}: {
  recipient: { key: string; name: string };
  onAllowed: () => void;
  shownElsewhere?: string;
  /** Not now: hides the prompt for this visit; it shows again next time. */
  onDismiss?: () => void;
}) {
  return (
    <ConsentCard
      id="inbox-consent"
      className="mb-3 py-2"
      heading={<Trans>Let Praci sort your mail</Trans>}
      sends={
        <Trans>
          The sender, subject and a preview of each message are sent to the AI model that runs your
          bots.
        </Trans>
      }
      onAllow={() => allowRecipient(recipient.key).then(onAllowed)}
      onDismiss={onDismiss}
      shownElsewhere={shownElsewhere}
    />
  );
}

/** One switch for every AI model that receives data; the models are listed under Advanced. Hidden when there is none or it cannot load. */
export function AiDataSharingSection() {
  const { t } = useLingui();
  // null until the first read, so the section holds its place instead of appearing late.
  const [recipients, setRecipients] = useState<AiRecipient[] | null>(null);
  // Files and contracts need their own consent; null until it loads or when it cannot.
  const [documents, setDocuments] = useState<DataRoomConsentStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const show = (status: AiConsentStatus) =>
    setRecipients(status.recipients.filter((recipient) => recipient.use === "model"));
  useEffect(() => {
    let live = true;
    aiConsentStatus()
      .then((status) => live && show(status))
      .catch(() => live && setRecipients([]));
    documentConsent()
      .then((status) => live && setDocuments(status))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (recipients?.length === 0) return null;
  const afterChange = (status: AiConsentStatus) => {
    show(status);
    // An open Inbox reloads, so its sorting and the consent prompt match the switch.
    window.dispatchEvent(new Event(INBOX_CHANGED_EVENT));
  };
  const run = (change: () => Promise<AiConsentStatus | undefined>) => {
    setPending(true);
    setError("");
    change()
      .then((status) => status && afterChange(status))
      // Revoking a model also takes back the document grant, so read it again.
      .then(() => documentConsent().then(setDocuments, () => undefined))
      .catch((cause) => setError(errorText(cause)))
      .finally(() => setPending(false));
  };
  const setOne = (recipient: AiRecipient, allowed: boolean) =>
    run(() => (allowed ? allowRecipient(recipient.key) : revokeRecipient(recipient.key)));
  const documentsNeeded = (documents?.recipients.length ?? 0) > 0;
  const setDocumentsAllowed = (allowed: boolean) =>
    run(async () => {
      if (allowed) await allowDocuments();
      else if (documents) await revokeRecipient(documents.key);
      return aiConsentStatus();
    });
  const setAll = (allowed: boolean) =>
    run(async () => {
      let status: AiConsentStatus | undefined;
      for (const recipient of recipients ?? []) {
        status = await (allowed ? allowRecipient(recipient.key) : revokeRecipient(recipient.key));
      }
      // The switch says it covers files and contracts, so it turns their consent on and off too.
      if (allowed && documentsNeeded && !documents?.allowed) await allowDocuments();
      if (!allowed && documents && documentsNeeded) await revokeRecipient(documents.key);
      return status ?? aiConsentStatus();
    });
  // On only when every model and the documents are allowed, so it matches what works; a partial
  // grant (for example the one a Mail Allow made) reads off and Advanced opens to show what is allowed.
  const allAllowed =
    (recipients?.every((recipient) => recipient.allowed) ?? false) &&
    (!documentsNeeded || documents?.allowed === true);
  const partlyAllowed =
    !allAllowed &&
    ((recipients?.some((recipient) => recipient.allowed) ?? false) || documents?.allowed === true);
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
      {/* The text above is fixed, so only the row waits. */}
      {recipients === null ? (
        <Skeleton className="mt-3 h-10 rounded-md" />
      ) : (
        <div className="mt-3 flex items-center gap-3 pointer-coarse:min-h-11">
          <Switch
            aria-label={t`Allow AI models`}
            checked={allAllowed}
            disabled={pending}
            onCheckedChange={setAll}
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-[14px] text-foreground/75">
              <Trans>Allow AI models</Trans>
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              <Trans>For bots, mail, files and contracts</Trans>
            </span>
          </span>
        </div>
      )}
      {/* With one model the switch above already is that model. */}
      {recipients && (recipients.length > 1 || documentsNeeded) ? (
        <details className="group mt-3" open={partlyAllowed}>
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <Trans>Advanced</Trans>
            <ChevronRight
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {recipients.map((recipient) => {
              const model = modelLabel(recipient.detail) || recipient.name;
              return (
                <li key={recipient.key} className="flex items-center gap-3 pointer-coarse:min-h-11">
                  <Switch
                    aria-label={model}
                    checked={recipient.allowed}
                    disabled={pending}
                    onCheckedChange={(allowed) => setOne(recipient, allowed)}
                  />
                  <span className="text-[14px] text-foreground/75">{model}</span>
                </li>
              );
            })}
            {documentsNeeded ? (
              <li className="flex items-center gap-3 pointer-coarse:min-h-11">
                <Switch
                  aria-label={t`Documents`}
                  checked={documents?.allowed === true}
                  disabled={pending}
                  onCheckedChange={setDocumentsAllowed}
                />
                <span className="text-[14px] text-foreground/75">
                  <Trans>Documents</Trans>
                </span>
              </li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

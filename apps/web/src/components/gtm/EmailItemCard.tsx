import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  ComposeResult,
  MailAccountSummary,
  MailApproval,
  MailEdits,
  ScratchpadItem,
} from "@rakazo/contracts";
import { Button, Input, NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { emailCompliance } from "../../lib/email-compliance";
import { splitEntries } from "../../lib/recipients";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { MailApprovalCard } from "../MailApprovalCard";

const fieldsFor = (item: ScratchpadItem): Required<MailEdits> => ({
  to: item.target ?? "",
  cc: "",
  bcc: "",
  subject: item.title,
  body: item.notes,
});

function outcomeText(result: ComposeResult): string {
  switch (result.status) {
    case "sent":
      return t`Sent`;
    case "unknown":
      return t`Sending was not confirmed. Check Sent in Inbox; this email will not be sent again.`;
    case "saved":
      return t`Draft saved, not sent.`;
    case "reconnect":
      return t`Reconnect Gmail in Inbox before sending.`;
    case "disabled":
      return t`Email sending is disabled.`;
    case "failed":
      return result.reason === "rate_limited"
        ? t`Gmail is limiting requests. Nothing was sent.`
        : t`Email was not sent. Review it before trying again.`;
  }
}

export function EmailItemCard({
  item,
  accounts,
  onChange,
}: {
  item: ScratchpadItem;
  accounts: MailAccountSummary[];
  onChange: () => void;
}) {
  const [fields, setFields] = useState(() => fieldsFor(item));
  const [connectionId, setConnectionId] = useState(accounts[0]?.connectionId ?? "");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [address, setAddress] = useState("");
  useEffect(() => {
    setFields(fieldsFor(item));
  }, [item.id, item.updatedAt, item.notes, item.title, item.target]);
  const account = accounts.find((value) => value.connectionId === connectionId) ?? accounts[0];
  const checks = emailCompliance(fields.body);
  const original = fieldsFor(item);
  const dirty = (Object.keys(original) as (keyof typeof original)[]).some(
    (key) => fields[key] !== original[key],
  );
  const validSize =
    fields.subject.trim().length > 0 &&
    fields.subject.length <= 200 &&
    fields.body.length <= 4000 &&
    fields.to.length <= 200;
  const mail: MailApproval = {
    tool: "mail_send",
    account: account?.address ?? account?.label,
    to: splitEntries(original.to).filter(Boolean),
    cc: [],
    bcc: [],
    subject: item.title,
    body: item.notes,
  };

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      if ((cause as { code?: string })?.code === "CONFLICT") {
        setError(t`Changed, review again`);
        onChange();
      } else setError(errorText(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function save(values: Required<MailEdits>) {
    await rpc.scratchpad.update({
      itemId: item.id,
      title: values.subject,
      target: values.to,
      notes: values.body,
    });
    onChange();
  }

  const answer = (answer: string, _username?: string, edits?: MailEdits) =>
    run(async () => {
      if (answer !== "allow") {
        await rpc.scratchpad.remove({ itemId: item.id });
        onChange();
        return;
      }
      if (!validSize) return;
      if (dirty || edits) {
        await save({ ...original, ...edits });
        return;
      }
      if (!account || !checks.unsubscribe || !checks.postalAddress) return;
      if (item.status === "open") {
        await rpc.scratchpad.update({ itemId: item.id, status: "parked" });
        onChange();
        return;
      }
      await rpc.scratchpad.update({ itemId: item.id, status: "open", updatedAt: item.updatedAt });
      const result = await rpc.inbox.compose.send({
        clientId: item.id,
        connectionId: account.connectionId,
        ...original,
      });
      setNotice(outcomeText(result));
      if (result.status === "sent" || result.status === "unknown") {
        await rpc.scratchpad.update({ itemId: item.id, status: "done", proof: `gmail:${item.id}` });
      } else {
        await rpc.scratchpad.update({ itemId: item.id, status: "parked" });
      }
      onChange();
    });

  return (
    <article data-item-id={item.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        {accounts.length > 1 ? (
          <label htmlFor={`gtm-email-from-${item.id}`} className="block text-xs">
            <Trans>From</Trans>
            <NativeSelect
              id={`gtm-email-from-${item.id}`}
              aria-label={t`From`}
              value={account?.connectionId ?? ""}
              onChange={(event) => setConnectionId(event.target.value)}
            >
              {accounts.map((value) => (
                <NativeSelectOption key={value.connectionId} value={value.connectionId}>
                  {value.address ?? value.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <MailApprovalCard
          key={item.updatedAt}
          mail={mail}
          status="pending"
          canAnswer
          initialEditing
          toOnly
          allowLabel={dirty ? t`Save` : item.status === "open" ? t`Review again` : t`Approve`}
          allowDisabled={
            busy ||
            !validSize ||
            (!dirty && (!account || !checks.unsubscribe || !checks.postalAddress))
          }
          onFieldsChange={setFields}
          onAnswer={answer}
        />
        <ul className="space-y-1 text-xs" aria-label={t`Email checks`}>
          <li className={checks.unsubscribe ? "text-muted-foreground" : "text-warning"}>
            {checks.unsubscribe ? t`Unsubscribe line present` : t`Add unsubscribe instructions`}
          </li>
          <li className={checks.postalAddress ? "text-muted-foreground" : "text-warning"}>
            {checks.postalAddress ? t`Postal address present` : t`Add a postal address`}
          </li>
        </ul>
        {!validSize ? (
          <p className="text-xs text-destructive">
            <Trans>
              Use a subject up to 200 characters, recipients up to 200, and a body up to 4,000.
            </Trans>
          </p>
        ) : null}
        {!account ? (
          <Link className="text-xs text-link underline" to="/app/inbox">
            <Trans>Connect Gmail in Inbox</Trans>
          </Link>
        ) : null}
        {item.status === "open" ? (
          <p className="text-xs text-warning">
            <Trans>Email send not recorded. Check Inbox before trying again.</Trans>
          </p>
        ) : null}
        {!checks.postalAddress && !addingAddress ? (
          <Button size="sm" variant="secondary" onClick={() => setAddingAddress(true)}>
            <Trans>Add address</Trans>
          </Button>
        ) : null}
        {addingAddress ? (
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label={t`Postal address`}
              value={address}
              maxLength={320}
              onChange={(event) => setAddress(event.target.value)}
            />
            <Button
              size="sm"
              disabled={
                address.trim().length < 10 ||
                `${fields.body}\n\nPostal address: ${address.trim()}`.length > 4000
              }
              onClick={() =>
                void run(async () => {
                  await save({
                    ...fields,
                    body: `${fields.body}\n\nPostal address: ${address.trim()}`,
                  });
                  setAddingAddress(false);
                })
              }
            >
              <Trans>Save address</Trans>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingAddress(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </div>
        ) : null}
      </fieldset>
      {notice ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </article>
  );
}

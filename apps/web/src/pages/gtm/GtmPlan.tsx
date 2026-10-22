import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { GtmOverview, GtmQueueOutput, ScratchpadItem } from "@rakazo/contracts";
import { GTM_CHANNELS } from "@rakazo/contracts";
import { Button, Input, Textarea } from "@rakazo/ui-web";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmailItemCard } from "../../components/gtm/EmailItemCard";
import { LinkedInPostPreview } from "../../components/gtm/LinkedInPostPreview";
import { XPostPreview } from "../../components/gtm/XPostPreview";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

export const isUncertain = (item: ScratchpadItem) =>
  item.status !== "done" &&
  /^[^:\s]{1,200}:[^:\s]{1,200}:[a-f0-9]{64}(?::[1-9]\d*)?$/.test(item.proof ?? "");
export function publicProof(proof: string) {
  try {
    const url = new URL(proof);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function GtmPlan({
  title,
  items,
  overview,
  onChange,
}: {
  title: string;
  items: ScratchpadItem[];
  overview: GtmOverview;
  onChange: () => void;
}) {
  // An empty group is left out: the page header already says "Up to date".
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
      </h2>
      {items.map((item) =>
        item.category === "outbound_email" && item.status !== "done" ? (
          <EmailItemCard
            key={item.id}
            item={item}
            accounts={overview.gmailAccounts}
            onChange={onChange}
          />
        ) : (
          <GtmItem key={item.id} item={item} overview={overview} onChange={onChange} />
        ),
      )}
    </section>
  );
}

export function GtmItem({
  item,
  overview,
  onChange,
}: {
  item: ScratchpadItem;
  overview: GtmOverview;
  onChange: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes);
  const [target, setTarget] = useState(item.target ?? "");
  const [scheduledFor, setScheduledFor] = useState(item.scheduledFor ?? "");
  const [proof, setProof] = useState("");
  const [marking, setMarking] = useState(false);
  const [queue, setQueue] = useState<{ version: string; result: GtmQueueOutput } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const uncertain = isUncertain(item);
  const queued = item.proof?.startsWith("zernio:");
  const gated = ["public_post", "create_account", "outbound_email"].includes(item.category ?? "");
  const post = item.category === "public_post";
  const email = item.category === "outbound_email";
  const canApprove = !email && (!post || overview.postingCapability === "ready");
  const queueChecked =
    queue?.version === item.updatedAt && queue.result.status === "ready" && queue.result.complete;
  const href = item.proof && publicProof(item.proof);

  const run = async (action: () => Promise<unknown>, refresh = true) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (refresh) onChange();
    } catch (cause) {
      if ((cause as { code?: string })?.code === "CONFLICT") {
        setError(t`Changed, review again`);
        setQueue(null);
        setConfirmed(false);
        onChange();
      } else setError(errorText(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const approve = (reapprove = false) =>
    run(() =>
      rpc.scratchpad.update({
        itemId: item.id,
        status: "open",
        updatedAt: item.updatedAt,
        ...(reapprove ? { reapprove: true } : {}),
      }),
    );
  const checkQueue = () =>
    run(async () => {
      setQueue(null);
      setConfirmed(false);
      const date = Date.parse(item.scheduledFor ?? "");
      if (!Number.isFinite(date)) throw new Error(t`This post has no valid scheduled time.`);
      const result = await rpc.gtm.queue({
        from: new Date(date - 86_400_000).toISOString(),
        to: new Date(date + 86_400_000).toISOString(),
      });
      setQueue({ version: item.updatedAt, result });
      if (result.status !== "ready" || !result.complete)
        throw new Error(t`Queue check incomplete. Check Zernio before trying again.`);
    }, false);

  return (
    <article data-item-id={item.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 break-words text-sm font-medium">{item.title}</h3>
        {item.channel ? (
          <span className="text-xs text-muted-foreground">{GTM_CHANNELS[item.channel].label}</span>
        ) : null}
      </div>
      {uncertain ? (
        <p className="mt-2 text-sm text-warning">
          <Trans>Posting may have failed</Trans>
        </p>
      ) : item.status === "parked" && item.updatedAt !== item.createdAt ? (
        <p className="mt-2 text-xs text-warning">
          <Trans>Changed</Trans>
        </p>
      ) : null}
      {editing ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await rpc.scratchpad.update({
                itemId: item.id,
                title,
                notes,
                target,
                ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
              });
              setEditing(false);
            });
          }}
        >
          <label className="block text-xs" htmlFor={`gtm-title-${item.id}`}>
            <Trans>Title</Trans>
            <Input
              id={`gtm-title-${item.id}`}
              value={title}
              maxLength={200}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="block text-xs" htmlFor={`gtm-notes-${item.id}`}>
            <Trans>Exact text</Trans>
            <Textarea
              id={`gtm-notes-${item.id}`}
              value={notes}
              maxLength={4000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <label className="block text-xs" htmlFor={`gtm-target-${item.id}`}>
            <Trans>Destination</Trans>
            <Input
              id={`gtm-target-${item.id}`}
              value={target}
              maxLength={200}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          {post ? (
            <label className="block text-xs" htmlFor={`gtm-scheduled-for-${item.id}`}>
              <Trans>Scheduled time (ISO)</Trans>
              <Input
                id={`gtm-scheduled-for-${item.id}`}
                value={scheduledFor}
                required
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </label>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy}>
              <Trans>Save</Trans>
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </form>
      ) : (
        <>
          {post && item.channel === "x" ? (
            <div className="mt-3">
              <XPostPreview
                text={item.notes}
                accountLabel={
                  overview.channels
                    .find((channel) => channel.channel === item.channel)
                    ?.accounts.find((account) => account.id === item.target)?.label
                }
              />
            </div>
          ) : post && item.channel === "linkedin" ? (
            <div className="mt-3">
              <LinkedInPostPreview
                text={item.notes}
                accountLabel={
                  overview.channels
                    .find((channel) => channel.channel === item.channel)
                    ?.accounts.find((account) => account.id === item.target)?.label
                }
              />
            </div>
          ) : item.notes ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {item.notes}
            </p>
          ) : null}
          {item.target || item.scheduledFor ? (
            <p className="mt-3 break-words text-xs text-muted-foreground">
              {item.target}
              {item.target && item.scheduledFor ? " · " : ""}
              {item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : null}
            </p>
          ) : null}
          {item.proof && !uncertain ? (
            <p className="mt-2 break-all text-xs">
              {href ? (
                <a className="text-link underline" href={href} target="_blank" rel="noreferrer">
                  {item.proof}
                </a>
              ) : queued ? (
                <>
                  <Trans>Queued in Zernio</Trans> · {item.proof}
                </>
              ) : (
                item.proof
              )}
            </p>
          ) : null}
          {item.status === "open" && gated && !item.proof ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <Trans>Approved, opens next wakeup</Trans>
            </p>
          ) : null}
          {item.status !== "done" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {uncertain ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void checkQueue()}
                >
                  <Trans>Check queue</Trans>
                </Button>
              ) : gated && item.status === "parked" && !queued ? (
                <Button size="sm" disabled={busy || !canApprove} onClick={() => void approve()}>
                  <Trans>Approve</Trans>
                </Button>
              ) : null}
              {!uncertain && !queued ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setTitle(item.title);
                    setNotes(item.notes);
                    setTarget(item.target ?? "");
                    setScheduledFor(item.scheduledFor ?? "");
                    setEditing(true);
                  }}
                >
                  <Trans>Edit</Trans>
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void run(() => rpc.scratchpad.remove({ itemId: item.id }))}
              >
                <Trans>Discard</Trans>
              </Button>
              {item.category === "draft" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => navigator.clipboard.writeText(item.notes), false)}
                  >
                    <Trans>Copy</Trans>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setMarking(true)}
                  >
                    <Trans>Mark posted</Trans>
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {post && item.status !== "done" && overview.postingCapability !== "ready" ? (
            <Link
              className="mt-2 block text-xs text-link underline"
              to={
                overview.zernioLinked
                  ? "/app/integrations?q=Zernio"
                  : "/app/integrations?connect=zernio&returnTo=/app/gtm"
              }
            >
              {overview.zernioLinked ? t`Posting needs an API key` : t`Connect Zernio first`}
            </Link>
          ) : null}
          {uncertain && queueChecked ? (
            <div className="mt-3 space-y-2 rounded-lg bg-muted p-3 text-sm">
              <p>
                <Trans>Provider queue around this scheduled time</Trans>
              </p>
              {queue.result.posts.length ? (
                <ul className="space-y-2">
                  {queue.result.posts.map((post) => (
                    <li key={post.id} className="break-words">
                      {post.content} · {new Date(post.scheduledFor).toLocaleString()} ·{" "}
                      {post.platforms.map((platform) => platform.accountId).join(", ")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  <Trans>No provider posts in this window</Trans>
                </p>
              )}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <Trans>I checked: this post is not in the queue</Trans>
              </label>
              <Button
                size="sm"
                disabled={busy || !confirmed || !canApprove}
                onClick={() => void approve(true)}
              >
                <Trans>Re-approve</Trans>
              </Button>
            </div>
          ) : null}
          {marking ? (
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (publicProof(proof))
                  void run(() => rpc.scratchpad.update({ itemId: item.id, status: "done", proof }));
              }}
            >
              <Input
                aria-label={t`Public URL`}
                placeholder="https://"
                type="url"
                required
                value={proof}
                onChange={(event) => setProof(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={busy || !publicProof(proof)}>
                <Trans>Save proof</Trans>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMarking(false)}>
                <Trans>Cancel</Trans>
              </Button>
            </form>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </article>
  );
}

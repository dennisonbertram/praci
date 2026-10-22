import { Trans, useLingui } from "@lingui/react/macro";
import type { MessagingField, MessagingSetupSave, MessagingSetupState } from "@rakazo/contracts";
import { isPrivateServerUrl } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rakazo/ui-web";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useCopyText } from "../../lib/copy-text";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "./AppLogo";
import { CardHead, IntegrationTile, SectionTitle } from "./parts";

type Provider = MessagingSetupState["providers"][number];
type FieldSpec = { id: string; label: string; secret?: boolean; optional?: boolean };

const TEST_TIMEOUT_MS = 10_000;

function Labeled({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function SetupDialog({
  provider,
  title,
  onSaved,
  onClose,
}: {
  provider: Provider;
  title: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [values, setValues] = useState<Record<string, string>>({});
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: true } | { ok: false; error: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, copy] = useCopyText();
  // Fields in form order; the ids are the server's saved field names.
  const specs: FieldSpec[] =
    provider.id === "bluebubbles"
      ? [
          { id: "serverUrl", label: t`Server URL` },
          { id: "password", label: t`Server password`, secret: true },
          { id: "webhookToken", label: t`Webhook token`, secret: true, optional: true },
        ]
      : [
          { id: "projectId", label: t`Project ID` },
          { id: "projectSecret", label: t`Project secret`, secret: true },
          { id: "webhookSecret", label: t`Webhook signing secret`, secret: true },
          { id: "address", label: t`Address`, optional: true },
        ];
  const url = values.serverUrl ?? provider.fields.serverUrl?.value ?? "";
  const publicUrl =
    provider.id === "bluebubbles" &&
    provider.fields.serverUrl?.source !== "server" &&
    /^https?:\/\//.test(url) &&
    !isPrivateServerUrl(url);

  const filled = specs.every(
    (spec) => spec.optional || (values[spec.id] ?? provider.fields[spec.id]?.value ?? "").trim(),
  );

  async function persist() {
    {
      const entered = Object.fromEntries(
        Object.entries(values)
          .filter(([, value]) => value.trim())
          .map(([key, value]) => [key, value.trim()]),
      );
      const current = (name: string) => provider.fields[name]?.value ?? "";
      await rpc.messagingSetup.save({
        provider: provider.id,
        ...(provider.id === "bluebubbles"
          ? { serverUrl: current("serverUrl") }
          : { projectId: current("projectId"), address: current("address") }),
        ...entered,
      } as MessagingSetupSave);
      setValues({});
      setReplacing({});
      setTest(null);
      setSaved(true);
      onSaved();
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await persist();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setBusy(true);
    setTest(null);
    setError("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The server tests the saved settings, so an unsaved form is saved first.
      if (!provider.configured) await persist();
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(t`No response from the server. Check the address.`)),
          TEST_TIMEOUT_MS,
        );
      });
      setTest(await Promise.race([rpc.messagingSetup.test({ provider: provider.id }), timeout]));
    } catch (cause) {
      setTest({ ok: false, error: errorText(cause) });
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  function input(spec: FieldSpec, field: MessagingField) {
    if (field.source === "server") {
      return (
        <Labeled id={`messaging-${spec.id}`} label={spec.label}>
          <div className="flex items-center gap-2">
            <Input
              id={`messaging-${spec.id}`}
              readOnly
              disabled
              aria-label={spec.label}
              value={spec.secret ? "••••••••" : (field.value ?? "")}
            />
            <span className="shrink-0 text-xs text-muted-foreground">
              <Trans>Set by server</Trans>
            </span>
          </div>
        </Labeled>
      );
    }
    if (spec.secret && field.source === "saved" && !replacing[spec.id]) {
      return (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-muted-foreground">
            {spec.label}: <Trans>Saved</Trans>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${t`Replace`} ${spec.label}`}
            onClick={() => setReplacing((prev) => ({ ...prev, [spec.id]: true }))}
          >
            <Trans>Replace</Trans>
          </Button>
        </div>
      );
    }
    return (
      <Labeled id={`messaging-${spec.id}`} label={spec.label}>
        <Input
          id={`messaging-${spec.id}`}
          autoComplete="off"
          spellCheck={false}
          type={spec.secret ? "password" : "text"}
          required={!spec.optional && !spec.secret}
          aria-label={spec.label}
          value={values[spec.id] ?? (spec.secret ? "" : (field.value ?? ""))}
          onChange={(e) => setValues((prev) => ({ ...prev, [spec.id]: e.target.value }))}
        />
      </Labeled>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="flex flex-col gap-3">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AppLogo name="iMessage" logo={null} />
              <DialogTitle>{title}</DialogTitle>
            </div>
          </DialogHeader>
          {specs.map((spec) => (
            <div key={spec.id}>{input(spec, provider.fields[spec.id] ?? { source: "empty" })}</div>
          ))}
          {publicUrl ? (
            <p role="status" className="text-sm text-warning">
              <Trans>
                Anyone who can reach this address can talk to your Mac's server. Use a private
                network or a tunnel.
              </Trans>
            </p>
          ) : null}
          {provider.webhookUrl ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="messaging-webhook-url" className="text-xs text-muted-foreground">
                {provider.id === "bluebubbles" ? (
                  <Trans>Paste this into BlueBubbles</Trans>
                ) : (
                  <Trans>Paste this into Photon</Trans>
                )}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="messaging-webhook-url"
                  readOnly
                  value={provider.webhookUrl}
                  onFocus={(e) => e.target.select()}
                />
                <Button type="button" variant="outline" onClick={() => copy(provider.webhookUrl!)}>
                  {copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
                </Button>
              </div>
            </div>
          ) : null}
          {test ? (
            <p
              role={test.ok ? "status" : "alert"}
              className={`text-sm ${test.ok ? "text-success" : "text-destructive"}`}
            >
              {test.ok ? <Trans>Connected</Trans> : test.error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="text-sm text-success">
              <Trans>Saved</Trans>
            </p>
          ) : null}
          {saved || (provider.configured && !provider.active) ? (
            <p role="status" className="text-sm text-warning">
              <Trans>Restart the Praci server to start using iMessage.</Trans>
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {saved ? <Trans>Done</Trans> : <Trans>Cancel</Trans>}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !(provider.configured || filled)}
              onClick={() => void runTest()}
            >
              {busy ? <Trans>Testing…</Trans> : <Trans>Test connection</Trans>}
            </Button>
            <Button type="submit" disabled={busy}>
              <Trans>Save</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** iMessage tiles for the deployment owner; hidden from everyone else. */
export function IMessageSection({
  query = "",
  flat = false,
  onShown,
  onOpenMessaging,
}: {
  query?: string;
  /** Results among other tiles: no heading of its own. */
  flat?: boolean;
  /** How many tiles match, so the page can tell "nothing matches" from "matches are in here". */
  onShown?: (count: number) => void;
  onOpenMessaging?: () => void;
}) {
  const { t } = useLingui();
  const [state, setState] = useState<MessagingSetupState | null>(null);
  const [editing, setEditing] = useState<Provider["id"] | null>(null);
  const load = () =>
    Promise.resolve()
      .then(() => rpc.messagingSetup.get())
      .then((next: MessagingSetupState) => setState(next))
      .catch(() => setState(null));
  useEffect(() => {
    void load();
  }, []);

  const tiles = [
    {
      id: "photon" as const,
      name: t`iMessage`,
      sub: t`Through a Photon project`,
    },
    {
      id: "bluebubbles" as const,
      name: t`iMessage on your Mac`,
      sub: t`Through BlueBubbles on your Mac`,
    },
  ].filter((tile) => tile.name.toLowerCase().includes(query.trim().toLowerCase()));
  const shown = state?.canConfigure ? tiles.length : 0;
  useEffect(() => {
    onShown?.(shown);
    return () => onShown?.(0);
  }, [shown, onShown]);
  if (!state?.canConfigure || shown === 0) return null;
  const open = tiles.find((tile) => tile.id === editing);
  const providerOf = (id: Provider["id"]) => state.providers.find((p) => p.id === id);
  return (
    <div data-flat={flat ? "" : undefined}>
      {flat ? null : (
        <SectionTitle>
          <Trans>Chat</Trans>
        </SectionTitle>
      )}
      <div
        data-flat={flat ? "" : undefined}
        className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
      >
        {tiles.map((tile) => {
          const provider = providerOf(tile.id);
          if (!provider) return null;
          return (
            <IntegrationTile key={tile.id}>
              <CardHead name={tile.name} logo={null} sub={tile.sub} />
              <div className="mt-auto flex items-center gap-2">
                {provider.active ? (
                  <span className="text-xs font-semibold text-success">
                    <Trans>Connected</Trans>
                  </span>
                ) : provider.configured ? (
                  <span className="text-xs font-semibold text-warning">
                    <Trans>Needs a server restart</Trans>
                  </span>
                ) : null}
                {provider.active && onOpenMessaging ? (
                  <Button size="sm" variant="ghost" onClick={onOpenMessaging}>
                    <Trans>Link a chat app</Trans>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="ms-auto"
                  aria-label={`${provider.configured ? t`Edit` : t`Connect`} ${tile.name}`}
                  onClick={() => setEditing(tile.id)}
                >
                  {provider.configured ? <Trans>Edit</Trans> : <Trans>Connect</Trans>}
                </Button>
              </div>
            </IntegrationTile>
          );
        })}
      </div>
      {open && providerOf(open.id) ? (
        <SetupDialog
          key={open.id}
          provider={providerOf(open.id)!}
          title={open.name}
          onSaved={() => void load()}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

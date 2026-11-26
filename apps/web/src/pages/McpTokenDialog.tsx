import { Trans, useLingui } from "@lingui/react/macro";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
} from "@rakazo/ui-web";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { rpc } from "../lib/rpc";

type TokenSpace = { id: string; name: string; current: boolean };

export function mcpAddCommand(mcpUrl: string, token: string) {
  return `claude mcp add --transport http praci ${mcpUrl} --header "Authorization: Bearer ${token}"`;
}

export function CopyBox({ label, value }: { label: string; value: string }) {
  const { t } = useLingui();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  return (
    <div>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] leading-5">{value}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={() => {
            void (async () => {
              try {
                if (!navigator.clipboard) throw new Error("Clipboard unavailable");
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setCopyFailed(false);
              } catch {
                setCopied(false);
                setCopyFailed(true);
              }
            })();
          }}
        >
          {copied ? <Check aria-label={t`Copied`} /> : <Copy />}
        </Button>
      </div>
      {copyFailed ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {t`Couldn't copy`}
        </p>
      ) : null}
    </div>
  );
}

/** The one time the token is visible, with the command that uses it. */
export function McpTokenReveal({
  token,
  mcpUrl,
  onDone,
}: {
  token: string;
  mcpUrl: string;
  onDone: () => void;
}) {
  const { t } = useLingui();
  return (
    <>
      <DialogBody className="space-y-3">
        <CopyBox label={t`Copy token`} value={token} />
        <CopyBox label={t`Copy command`} value={mcpAddCommand(mcpUrl, token)} />
        <p className="text-sm text-muted-foreground">
          <Trans>You won't see this token again.</Trans>
        </p>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone}>
          <Trans>Done</Trans>
        </Button>
      </DialogFooter>
    </>
  );
}

export function McpTokenDialog({
  spaces,
  mcpUrl,
  onCreated,
  onClose,
}: {
  spaces: TokenSpace[];
  mcpUrl: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [label, setLabel] = useState("");
  const [spaceId, setSpaceId] = useState((spaces.find((s) => s.current) ?? spaces[0])?.id ?? "");
  const [readOnly, setReadOnly] = useState(true);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function create() {
    setPending(true);
    setFailed(false);
    try {
      const created = await rpc.mcpConnections.createToken({ spaceId, label, readOnly });
      setToken(created.token);
      onCreated();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {token ? <Trans>Token created</Trans> : <Trans>Create token</Trans>}
          </DialogTitle>
        </DialogHeader>
        {token ? (
          <McpTokenReveal token={token} mcpUrl={mcpUrl} onDone={onClose} />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!pending && label.trim()) void create();
            }}
          >
            <DialogBody className="space-y-4">
              <Input
                aria-label={t`Name`}
                placeholder={t`Name`}
                value={label}
                maxLength={80}
                autoFocus
                onChange={(event) => setLabel(event.target.value)}
              />
              {spaces.length > 1 ? (
                <NativeSelect
                  className="w-full"
                  aria-label={t`Space`}
                  value={spaceId}
                  onChange={(event) => setSpaceId(event.target.value)}
                >
                  {spaces.map((space) => (
                    <NativeSelectOption key={space.id} value={space.id}>
                      {space.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-sm">
                <Trans>Read-only</Trans>
                <Switch
                  aria-label={t`Read-only`}
                  checked={readOnly}
                  onCheckedChange={setReadOnly}
                />
              </div>
              {failed ? (
                <p role="alert" className="text-sm text-destructive">
                  <Trans>Could not create the token</Trans>
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                <Trans>Cancel</Trans>
              </Button>
              <Button type="submit" disabled={pending || !label.trim()}>
                <Trans>Create</Trans>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

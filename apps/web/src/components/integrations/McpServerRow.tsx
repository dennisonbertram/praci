import { Trans, useLingui } from "@lingui/react/macro";
import type { McpServer } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { connectMcpOauth } from "../../lib/mcp-connect";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** One connected MCP server with reconnect, rename and remove. */
export function McpServerRow({ server, onChanged }: { server: McpServer; onChanged: () => void }) {
  const { t } = useLingui();
  const [draft, setDraft] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOauth = server.oauthStatus !== "none";

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  // The stored sign-in is replaced only when the new one completes, so a
  // cancelled or failed attempt leaves the server connected as before.
  const reconnect = () =>
    run(async () => {
      const result = await connectMcpOauth(server.id, { reauthorize: true });
      if (result === "authorization_not_requested" || result === "already_connected") {
        setError(t`This server did not request browser authorization.`);
      }
    }, t`Could not reconnect`);

  const rename = () =>
    run(async () => {
      const name = (draft ?? "").trim();
      setDraft(null);
      if (name && name !== server.name) await rpc.mcp.servers.rename({ id: server.id, name });
    }, t`Could not rename`);

  const remove = () =>
    run(async () => {
      await rpc.mcp.servers.remove({ id: server.id });
    }, t`Could not remove`);

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-foreground">
          {server.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          {draft === null ? (
            <div className="truncate text-[15px] font-medium text-foreground">{server.name}</div>
          ) : (
            <Input
              autoFocus
              aria-label={t`Name`}
              className="h-7 px-2 text-[15px]"
              value={draft}
              maxLength={120}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void rename();
                if (event.key === "Escape") setDraft(null);
              }}
            />
          )}
          <div
            className={`truncate text-[12.5px] ${server.oauthStatus === "reconnect" ? "text-warning" : "text-muted-foreground"}`}
          >
            {busy
              ? t`Connecting…`
              : server.oauthStatus === "reconnect"
                ? t`OAuth expired`
                : server.endpoint
                  ? new URL(server.endpoint).host
                  : server.command}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t`Manage ${server.name}`}
            disabled={busy}
            render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-36">
            {isOauth ? (
              <DropdownMenuItem onClick={() => void reconnect()}>
                <Trans>Reconnect</Trans>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => setDraft(server.name)}>
              <Trans>Rename</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
              <Trans>Remove</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error ? (
        <p role="alert" className="px-2.5 text-[12.5px] text-destructive">
          {error}
        </p>
      ) : null}
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Remove {server.name}?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>Bots lose access to its tools.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              <Trans>Remove</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

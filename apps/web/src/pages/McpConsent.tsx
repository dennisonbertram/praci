import { Trans, useLingui } from "@lingui/react/macro";
import { Button, NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth";
import { AuthFrame } from "./Auth";

export type ConsentSpace = { id: string; name: string };

/** One screen for the two choices Better Auth asks for: which Space, and whether to allow. */
export function McpConsent({
  clientName,
  redirectHost,
  spaces,
  pending,
  failed,
  invalid,
  onAllow,
  onCancel,
}: {
  clientName: string;
  redirectHost: string;
  spaces: ConsentSpace[];
  pending: boolean;
  failed: boolean;
  /** The request cannot be approved; only cancelling it is offered. */
  invalid: boolean;
  onAllow: (spaceId: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const chosen = spaces.find((space) => space.id === spaceId) ?? spaces[0];
  return (
    <AuthFrame
      title={<Trans>Connect {clientName}</Trans>}
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen && !invalid) onAllow(chosen.id);
      }}
    >
      {invalid ? (
        <p role="alert" className="-mt-6 mb-6 text-sm text-destructive">
          <Trans>This connection request is not valid</Trans>
        </p>
      ) : (
        <>
          <p className="-mt-6 mb-6 text-sm text-muted-foreground">{redirectHost}</p>
          {spaces.length > 1 ? (
            <NativeSelect
              className="w-full"
              aria-label={t`Space`}
              value={chosen?.id}
              onChange={(event) => setSpaceId(event.target.value)}
            >
              {spaces.map((space) => (
                <NativeSelectOption key={space.id} value={space.id}>
                  {space.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <p className="text-base font-medium">{chosen?.name}</p>
          )}
          {failed ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              <Trans>Could not connect</Trans>
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending || !chosen}
            className="mt-6 h-12 w-full rounded-xl text-base"
          >
            <Trans>Allow</Trans>
          </Button>
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={onCancel}
        className="mt-2 h-12 w-full rounded-xl text-base"
      >
        <Trans>Cancel</Trans>
      </Button>
    </AuthFrame>
  );
}

type Reply = { data: unknown; error: unknown };

/** The address Better Auth sends the browser to next, when the reply carries one. */
function redirectUrl(reply: Reply): string | undefined {
  const data = reply.data as { redirect?: boolean; url?: string } | null;
  return data?.redirect && data.url ? data.url : undefined;
}

/** The host shown under the title; null when the request's redirect URI is not a URL at all. */
function safeRedirectHost(redirectUri: string | null): string | null {
  if (redirectUri === null) return "";
  try {
    return new URL(redirectUri).host;
  } catch {
    return null;
  }
}

export function McpConsentPage() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri");
  const redirectHost = safeRedirectHost(redirectUri);
  // A redirect URI the URL parser rejects is not one a client registered; the request is unsafe.
  const invalid = redirectHost === null;
  const [clientName, setClientName] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<ConsentSpace[] | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      const [client, list] = await Promise.all([
        authClient
          .$fetch<{ client_name?: string }>("/oauth2/public-client", {
            query: { client_id: clientId },
          })
          .catch(() => null),
        authClient.$fetch<{ spaces: ConsentSpace[] }>("/mcp/spaces"),
      ]);
      if (list.error) throw new Error("spaces");
      setClientName((client?.data as { client_name?: string } | null)?.client_name || clientId);
      setSpaces((list.data as { spaces?: ConsentSpace[] } | null)?.spaces ?? []);
    })().catch(() => {
      setClientName((name) => name ?? clientId);
      setFailed(true);
    });
  }, [clientId]);

  async function decide(accept: boolean, spaceId?: string) {
    if (accept && invalid) return;
    setPending(true);
    setFailed(false);
    try {
      if (accept) {
        const picked = await authClient.$fetch("/mcp/space", { method: "POST", body: { spaceId } });
        if (picked.error) throw new Error("space");
      }
      const reply = await authClient.$fetch("/oauth2/consent", {
        method: "POST",
        body: { accept },
      });
      const url = redirectUrl(reply);
      if (!url) throw new Error("consent");
      window.location.assign(url);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  if ((!clientName || !spaces) && !failed && !invalid)
    return (
      <AuthFrame title="" onSubmit={() => undefined}>
        {null}
      </AuthFrame>
    );
  return (
    <McpConsent
      clientName={clientName ?? clientId}
      redirectHost={redirectHost ?? ""}
      spaces={spaces ?? []}
      pending={pending}
      failed={failed}
      invalid={invalid}
      onAllow={(spaceId) => void decide(true, spaceId)}
      onCancel={() => void decide(false)}
    />
  );
}

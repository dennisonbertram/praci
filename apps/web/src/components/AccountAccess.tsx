import { Trans, useLingui } from "@lingui/react/macro";
import type { AccountSecurity } from "@rakazo/contracts";
import { Button, Input, Label } from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { fetchAccountSecurity, requestAccountDeletionCode } from "../lib/account-security";
import { authClient } from "../lib/auth";
import { runSsoFlow } from "../lib/sso-flow";
import { authErrorText, errorText } from "../lib/user-error";

/** Brings the opened form into view by scrolling only the pane that holds it, never the dialog around it. */
function revealInPane(node: HTMLElement) {
  let pane = node.parentElement;
  while (pane && !/auto|scroll/.test(getComputedStyle(pane).overflowY)) pane = pane.parentElement;
  if (!pane) return;
  const overflow = node.getBoundingClientRect().bottom - pane.getBoundingClientRect().bottom;
  if (overflow > 0) pane.scrollTop += overflow;
}

export function AccountAccess({
  onSecurity,
}: {
  onSecurity?: (security: AccountSecurity) => void;
}) {
  const { t } = useLingui();
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    return code ? authErrorText({ code }, t`Could not continue`) : null;
  });
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && formRef.current) revealInPane(formRef.current);
  }, [open]);
  // A failed load is shown only where it matters: in the opened delete panel, beside Retry.
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchAccountSecurity()
      .then((value) => {
        if (active) {
          setSecurity(value);
          onSecurity?.(value);
        }
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, onSecurity]);
  async function action(run: () => Promise<unknown>, sso = false) {
    if (!sso) setPending(true);
    setError(null);
    try {
      await run();
    } catch (error) {
      setError(errorText(error, t`Could not continue`));
    } finally {
      if (!sso) setPending(false);
    }
  }
  return (
    <div className="mt-3 space-y-3">
      {security?.sso && !security.ssoLinked ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            void action(async () => {
              const result = await runSsoFlow(
                (disableRedirect, callbackURL) =>
                  authClient.linkSocial({
                    disableRedirect,
                    provider: "oidc",
                    callbackURL: callbackURL(window.location.href),
                    errorCallbackURL: callbackURL(window.location.href),
                  }),
                [window.location.href],
              );
              if (result.error) throw new Error(authErrorText(result.error, t`Could not continue`));
            }, true)
          }
        >
          <Trans>Link SSO</Trans>
        </Button>
      ) : null}
      {open ? null : (
        <div className="pt-1">
          <Button variant="destructive" onClick={() => setOpen(true)}>
            <Trans>Delete account</Trans>
          </Button>
        </div>
      )}
      {open ? (
        <div ref={formRef} className="space-y-3">
          <p className="text-sm">
            <Trans>This permanently deletes your account and data.</Trans>
          </p>
          {!security ? (
            loadFailed ? (
              <div className="flex items-center gap-3">
                <p role="alert" className="text-sm text-destructive">
                  <Trans>Could not load sign-in options.</Trans>
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLoadFailed(false);
                    setAttempt((value) => value + 1);
                  }}
                >
                  <Trans>Retry</Trans>
                </Button>
              </div>
            ) : null
          ) : security.hasPassword ? (
            <div className="grid gap-2">
              <Label htmlFor="delete-password">
                <Trans>Current password</Trans>
              </Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          ) : (
            <>
              {security.sso ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void action(async () => {
                      const result = await runSsoFlow(
                        (disableRedirect, callbackURL) =>
                          authClient.signIn.social({
                            disableRedirect,
                            provider: "oidc",
                            additionalData: { reauthenticate: true },
                            callbackURL: callbackURL(window.location.href),
                            errorCallbackURL: callbackURL(window.location.href),
                          }),
                        [window.location.href],
                      );
                      if (result.error)
                        throw new Error(authErrorText(result.error, t`Could not continue`));
                    }, true)
                  }
                >
                  <Trans>Sign in again</Trans>
                </Button>
              ) : null}
              {security.emailDeletion ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    void action(async () => {
                      await requestAccountDeletionCode();
                      setSent(true);
                    })
                  }
                >
                  <Trans>Send deletion code</Trans>
                </Button>
              ) : null}
              {sent ? (
                <div className="grid gap-2">
                  <Label htmlFor="deletion-code">
                    <Trans>Deletion code</Trans>
                  </Label>
                  <Input
                    id="deletion-code"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          )}
          <Button
            variant="destructive"
            disabled={
              pending ||
              !security ||
              (security.hasPassword && !password) ||
              (!security.hasPassword && !security.freshOidcAuth && !code.trim())
            }
            onClick={() =>
              void action(async () => {
                const current = await fetchAccountSecurity();
                setSecurity(current);
                onSecurity?.(current);
                if (!current.hasPassword && !current.freshOidcAuth && !code.trim()) return;
                if (current.hasPassword && !password) return;
                const result = await authClient.deleteUser(
                  current.hasPassword ? { password } : code.trim() ? { token: code.trim() } : {},
                );
                if (result.error)
                  throw new Error(authErrorText(result.error, t`Could not continue`));
                window.location.assign("/sign-in");
              })
            }
          >
            <Trans>Delete account</Trans>
          </Button>
          <Button
            variant="ghost"
            className="ms-2"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

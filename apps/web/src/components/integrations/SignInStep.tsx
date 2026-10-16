import { Trans, useLingui } from "@lingui/react/macro";
import { Button, DialogDescription, DialogTitle } from "@rakazo/ui-web";
import { Loader2 } from "lucide-react";
import { AppLogo } from "./AppLogo";

export type SignInState =
  /** `closed`: the sign-in window reads as closed, which some providers cause without the user closing it. */
  { kind: "waiting"; closed?: boolean } | { kind: "blocked" } | { kind: "failed"; message: string };

/** Step 1 of the connect dialogs: waiting for sign-in, and the ways it can stop. */
export function SignInStep({
  appName,
  logo,
  state,
  onOpenAgain,
  onTryAgain,
  onClose,
}: {
  appName: string;
  logo?: string | null;
  state: SignInState;
  /** Opens the sign-in window again (from the waiting or blocked state). */
  onOpenAgain?: () => void;
  onTryAgain: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const header = (
    <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
      <Trans>Step 1 of 3</Trans>
    </div>
  );
  if (state.kind === "waiting") {
    return (
      <div className="text-center">
        {header}
        <div className="mb-3 flex justify-center">
          <AppLogo name={appName} logo={logo} size="xl" />
        </div>
        <DialogTitle className="text-center">
          <Trans>Sign in to {appName} in the new window</Trans>
        </DialogTitle>
        <DialogDescription className="text-center">
          <Trans>Choose the account to connect, then come back here.</Trans>
        </DialogDescription>
        <Loader2
          role="status"
          aria-label={t`Waiting for sign-in`}
          className="mx-auto my-4 size-8 animate-spin text-muted-foreground"
        />
        {state.closed && onOpenAgain ? (
          <p className="text-sm text-muted-foreground">
            <Trans>If you closed the sign-in window, try again.</Trans>{" "}
            <button type="button" className="underline underline-offset-2" onClick={onOpenAgain}>
              <Trans>Try again</Trans>
            </button>
          </p>
        ) : onOpenAgain ? (
          <p className="text-sm text-muted-foreground">
            <Trans>Didn't open?</Trans>{" "}
            <button type="button" className="underline underline-offset-2" onClick={onOpenAgain}>
              <Trans>Open again</Trans>
            </button>
          </p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      {header}
      <DialogTitle>
        {state.kind === "blocked" ? (
          <Trans>Your browser blocked the sign-in window</Trans>
        ) : (
          <Trans>{appName} was not connected</Trans>
        )}
      </DialogTitle>
      <DialogDescription>
        {state.kind === "blocked" ? (
          <Trans>Allow pop-ups for this site, or open the sign-in page directly.</Trans>
        ) : (
          state.message
        )}
      </DialogDescription>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {state.kind === "blocked" ? <Trans>Cancel</Trans> : <Trans>Close</Trans>}
        </Button>
        {state.kind === "blocked" ? (
          <Button onClick={onOpenAgain}>
            <Trans>Open sign-in</Trans>
          </Button>
        ) : (
          <Button onClick={onTryAgain}>
            <Trans>Try again</Trans>
          </Button>
        )}
      </div>
    </div>
  );
}

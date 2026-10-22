import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { openPortal, PortalDeadError } from "../../lib/portal";
import { PortalDead } from "./PortalDead";

/**
 * The landing page of a link. The token is in the URL fragment, which browsers never send, so no
 * request carries it until the Open button posts it. No company name: nothing is known yet.
 */
export function PortalOpen() {
  const navigate = useNavigate();
  const [token] = useState(() => window.location.hash.slice(1));
  const [dead, setDead] = useState(token === "");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (dead) return <PortalDead />;

  const open = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await openPortal(token);
      // The session cookie is set; the link token has no further use, so it leaves the address bar.
      window.history.replaceState(null, "", "/portal/open");
      navigate("/portal/home", { replace: true });
    } catch (cause) {
      if (cause instanceof PortalDeadError) setDead(true);
      else setFailed(true);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-foreground">
      <Button size="lg" className="min-h-11 min-w-40" disabled={busy} onClick={() => void open()}>
        <Trans>Open</Trans>
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t`Something went wrong. Try again.`}
        </p>
      ) : null}
    </main>
  );
}

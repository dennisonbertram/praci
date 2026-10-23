import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, IntegrationSetupState } from "@rakazo/contracts";
import { Button, Label, NativeSelect, NativeSelectOption } from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IntegrationSetup } from "../components/integrations/IntegrationSetup";
import { appReturnPath } from "../lib/return-to";
import { rpc } from "../lib/rpc";

export function IntegrationSetupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const serverSetup = params.get("mode") !== "mcp";
  const { t } = useLingui();
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState("");
  const [ready, setReady] = useState(false);
  const [setupState, setSetupState] = useState<IntegrationSetupState | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    setReady(false);
    setError(false);
    let cancelled = false;
    void Promise.all([rpc.bots.list(), serverSetup ? rpc.integrationSetup.get() : null])
      .then(([rows, setup]) => {
        if (cancelled) return;
        if (serverSetup && !setup?.canConfigure) {
          navigate("/app", { replace: true });
          return;
        }
        if (!rows.length) {
          navigate("/onboarding", { replace: true });
          return;
        }
        setSetupState(setup);
        setBots(rows);
        setBotId(rows[0]?.id ?? "");
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [serverSetup, navigate]);
  // Back, Continue and Skip all return to where the person came from (Settings passes `next`).
  const back = () =>
    navigate(bots.length ? (appReturnPath(params.get("next")) ?? "/app") : "/onboarding");
  return (
    <div className="rk-scroll h-full min-h-full overflow-y-auto bg-background px-4 pt-2 pb-8 md:px-7">
      <div className="mx-auto max-w-[560px]">
        <Button variant="ghost" size="sm" className="-ms-2 mb-4" onClick={back}>
          <ArrowLeft aria-hidden="true" />
          <Trans>Back</Trans>
        </Button>
        {ready ? (
          <IntegrationSetup
            key={serverSetup ? "server" : "mcp"}
            serverSetup={serverSetup}
            initialState={setupState}
            botId={botId || undefined}
            onDone={back}
          />
        ) : (
          <p>{error ? t`Could not load bots. Reload to try again.` : t`Loading…`}</p>
        )}
        {ready && bots.length > 1 ? (
          <div className="mt-8 flex flex-col gap-1.5">
            <Label htmlFor="integration-setup-bot">
              <Trans>Bot that gets the apps you connect here</Trans>
            </Label>
            <NativeSelect
              id="integration-setup-bot"
              value={botId}
              onChange={(event) => setBotId(event.target.value)}
              className="w-full"
            >
              {bots.map((bot) => (
                <NativeSelectOption key={bot.id} value={bot.id}>
                  {bot.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>
    </div>
  );
}

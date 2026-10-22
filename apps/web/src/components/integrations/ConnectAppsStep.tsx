import { useLingui } from "@lingui/react/macro";
import type { ConnectionCatalogItem, IntegrationSetupState } from "@rakazo/contracts";
import { Button, Input } from "@rakazo/ui-web";
import { useState } from "react";
import { appKey } from "../../lib/integrations";
import { AppLogo } from "./AppLogo";
import { ConnectAppDialog } from "./ConnectAppDialog";
import type { SetupChoice } from "./IntegrationSetup";
import { IntegrationSetup } from "./IntegrationSetup";
import type { IntegrationsData } from "./useIntegrations";
import { useIntegrations } from "./useIntegrations";

/** The apps people ask for first. `via` is the provider to set up when the catalog lacks the app. */
const POPULAR: readonly { name: string; slugs: readonly string[]; via: SetupChoice }[] = [
  { name: "Gmail", slugs: ["gmail"], via: "google" },
  { name: "Google Calendar", slugs: ["googlecalendar"], via: "google" },
  { name: "Google Drive", slugs: ["googledrive"], via: "google" },
  { name: "Slack", slugs: ["slack"], via: "composio" },
  { name: "Notion", slugs: ["notion"], via: "composio" },
  { name: "GitHub", slugs: ["github"], via: "composio" },
];

const flat = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

type Row = {
  key: string;
  name: string;
  item?: ConnectionCatalogItem;
  via: SetupChoice;
};

/**
 * Onboarding: connect apps by name. The provider behind each app (Google sign-in, Composio,
 * Pipedream, a server URL) only appears under "Other ways to connect", or when an app needs one.
 */
export function ConnectAppsStep({
  data,
  setup,
  onDone,
  onServerConnected,
}: {
  data: IntegrationsData;
  setup: IntegrationSetupState | null;
  onDone: () => void;
  onServerConnected?: (id: string) => void;
}) {
  const { t } = useLingui();
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState<ConnectionCatalogItem | null>(null);
  const [more, setMore] = useState(false);
  const [choice, setChoice] = useState<SetupChoice | undefined>();
  const [serversAdded, setServersAdded] = useState(0);

  const used = new Set(
    data.connections
      .filter((row) => row.status !== "revoked")
      .map((row) => appKey({ connectorId: row.connectorId, slug: row.provider })),
  );
  const find = (slugs: readonly string[]) =>
    data.catalog.find((item) => slugs.includes(flat(item.slug)) || slugs.includes(flat(item.name)));
  const popular: Row[] = POPULAR.map(({ name, slugs, via }) => {
    const item = find(slugs);
    return { key: item ? appKey(item) : `setup:${name}`, name, item, via };
  });
  const needle = query.trim().toLowerCase();
  // A search looks through the whole catalog, not just the popular apps.
  const rows: Row[] = needle
    ? [
        ...popular.filter((row) => row.name.toLowerCase().includes(needle)),
        ...data.catalog
          .filter(
            (item) =>
              item.name.toLowerCase().includes(needle) &&
              !popular.some((row) => row.key === appKey(item)),
          )
          .map((item): Row => ({ key: appKey(item), name: item.name, item, via: "composio" })),
      ].slice(0, 8)
    : popular;
  // A provider the owner just configured counts: its apps are ready to connect.
  const connectedAny =
    serversAdded > 0 ||
    used.size > 0 ||
    Boolean(data.setup?.providers.some((provider) => provider.configured));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">{t`Connect your apps`}</h1>
      <Input
        aria-label={t`Search integrations`}
        placeholder={t`Search integrations`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {rows.length ? (
        <ul className="overflow-hidden rounded-xl border border-border">
          {rows.map(({ key, name, item, via }) => (
            <li
              key={key}
              className="flex min-h-14 items-center gap-3 border-b border-border px-3.5 py-2 last:border-0"
            >
              <AppLogo name={name} logo={item?.logo} size="sm" />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {item && used.has(appKey(item)) ? (
                <span className="text-sm text-success">{t`Connected`}</span>
              ) : item ? (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={t`Connect ${name}`}
                  onClick={() => setConnecting(item)}
                >
                  {t`Connect`}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={t`Set up ${name}`}
                  onClick={() => {
                    setChoice(via);
                    setMore(true);
                  }}
                >
                  {t`Set up`}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t`No matching apps`}</p>
      )}
      <details
        className="text-sm"
        open={more}
        onToggle={(event) => setMore(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-muted-foreground">{t`Other ways to connect`}</summary>
        <div className="mt-4">
          <IntegrationSetup
            // A "Set up" button picks the provider, so the setup form starts fresh on it.
            key={choice ?? "default"}
            serverSetup
            embedded
            initialChoice={choice}
            initialState={setup}
            onSaved={() => void data.refresh()}
            onServerConnected={(id) => {
              setServersAdded((count) => count + 1);
              onServerConnected?.(id);
            }}
          />
        </div>
      </details>
      <div className="flex gap-3">
        {connectedAny ? <Button onClick={onDone}>{t`Continue`}</Button> : null}
        <Button variant={connectedAny ? "ghost" : "outline"} onClick={onDone}>
          {t`Skip for now`}
        </Button>
      </div>
      {connecting ? (
        <ConnectAppDialog item={connecting} data={data} onClose={() => setConnecting(null)} />
      ) : null}
    </div>
  );
}

/** The onboarding step: loads the app list, then shows it. */
export function OnboardingConnectApps(props: {
  setup: IntegrationSetupState | null;
  onDone: () => void;
  onServerConnected?: (id: string) => void;
}) {
  const data = useIntegrations();
  return data.loaded ? <ConnectAppsStep data={data} {...props} /> : null;
}

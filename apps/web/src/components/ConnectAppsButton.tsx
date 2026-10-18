import { Trans } from "@lingui/react/macro";
import type { Connection, ConnectionCatalogItem } from "@rakazo/contracts";
import { preferNativeGoogle } from "@rakazo/contracts";
import { matchFeaturedConnectorId } from "@rakazo/core";
import { LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { desktopBridge, nativeGoogleAvailable } from "../lib/desktop";
import { popularApps } from "../lib/integrations";
import { rpc } from "../lib/rpc";
import { AppLogo } from "./integrations/AppLogo";

/** Featured apps this space has not connected yet, at most three. */
export function unconnectedFeatured(
  catalog: ConnectionCatalogItem[],
  connections: readonly Connection[],
): ConnectionCatalogItem[] {
  const visible = preferNativeGoogle(catalog, {
    nativeGoogle: nativeGoogleAvailable(desktopBridge()),
  });
  const connected = connections.filter((c) => c.status === "connected");
  const connectedIds = new Set(connected.map((c) => matchFeaturedConnectorId(c.provider)));
  const seen = new Set<string>();
  return popularApps(visible, connected)
    .filter((item) => {
      const id = matchFeaturedConnectorId(item.slug) ?? matchFeaturedConnectorId(item.name);
      if (id === null || connectedIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 3);
}

/**
 * The sidebar's Integrations row. While featured apps are unconnected it is a "Connect apps" pill
 * with their logos; once they are connected, and while loading or on failure, it is the plain row.
 */
export function ConnectAppsButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [apps, setApps] = useState<ConnectionCatalogItem[]>([]);
  // Reload on mount and when leaving the Integrations page, where apps get connected.
  useEffect(() => {
    if (active) return;
    let cancelled = false;
    const load = () => {
      void Promise.all([rpc.connections.featured(), rpc.connections.list()])
        .then(([catalog, connections]) => {
          if (!cancelled) setApps(unconnectedFeatured(catalog, connections));
        })
        .catch(() => {
          if (!cancelled) setApps([]);
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (apps.length > 0 && !active) {
    return (
      <button
        type="button"
        data-testid="sidebar-integrations"
        onClick={onClick}
        className="mx-3 mb-1 flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 rounded-full border border-sidebar-border bg-muted py-1.5 pl-4 pr-2 hover:bg-sidebar-accent"
      >
        <span className="text-[14px] font-medium text-foreground/90">
          <Trans>Connect apps</Trans>
        </span>
        <span aria-hidden className="flex -space-x-1.5">
          {apps.map((app) => (
            <span key={app.slug} className="rounded-md ring-2 ring-sidebar">
              <AppLogo name={app.name} logo={app.logo} size="sm" />
            </span>
          ))}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      data-testid="sidebar-integrations"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`mx-3 mb-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-sidebar-accent ${
        active ? "bg-sidebar-accent" : ""
      }`}
    >
      <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-accent text-foreground/80">
        <LayoutGrid size={15} strokeWidth={1.8} />
      </span>
      <span className="text-[14px] font-medium text-foreground/90">
        <Trans>Integrations</Trans>
      </span>
    </button>
  );
}

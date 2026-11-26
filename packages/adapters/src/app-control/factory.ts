import path from "node:path";
import type { AppControlProvider, AppControlStore } from "@rakazo/adapter-kit";
import { AgentDesktopAppControl } from "./agent-desktop.js";
import { FakeAppControl } from "./fake.js";
import { bridgeAgentDesktopRunner, spawnAgentDesktopRunner } from "./runners.js";

/**
 * APP_CONTROL_PROVIDER=agent-desktop|fake turns the feature on; unset means none.
 * agent-desktop goes through the desktop app's bridge when APP_CONTROL_BRIDGE_URL and
 * APP_CONTROL_BRIDGE_TOKEN are set, else runs on this machine (development, tests, desktop app).
 */
export function createAppControlProvider(
  env: NodeJS.ProcessEnv,
  opts: { dataDir: string; store: AppControlStore },
): AppControlProvider | undefined {
  const kind = env.APP_CONTROL_PROVIDER?.trim();
  if (kind === "fake") return new FakeAppControl({ store: opts.store });
  if (kind !== "agent-desktop") return undefined;
  const url = env.APP_CONTROL_BRIDGE_URL?.trim();
  const token = env.APP_CONTROL_BRIDGE_TOKEN?.trim();
  const runner =
    url && token
      ? bridgeAgentDesktopRunner({ url, token })
      : spawnAgentDesktopRunner({ privateDir: path.join(opts.dataDir, "app-control"), env });
  // A bridge runs the CLI on the owner's host, so this process's platform says nothing.
  return new AgentDesktopAppControl({
    runner,
    store: opts.store,
    platform: url && token ? null : undefined,
  });
}

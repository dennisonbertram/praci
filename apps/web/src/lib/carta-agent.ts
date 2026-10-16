import type { McpServer } from "@rakazo/contracts";
import { cartaAgentSpawnKey, isCartaEndpoint } from "@rakazo/contracts";
import { useEffect, useRef, useState } from "react";
import { mcpStatus } from "./integrations";
import { rpc } from "./rpc";

/** The signed-in user's own Carta agent; another member's agent in the same space does not match. */
export function findCartaAgent<T extends { spawnKey: string | null }>(
  bots: readonly T[],
  userId: string | null | undefined,
): T | undefined {
  if (!userId) return undefined;
  const key = cartaAgentSpawnKey(userId);
  return bots.find((bot) => bot.spawnKey === key);
}

/** Whether an enabled Carta server is signed in. */
export function hasConnectedCarta(servers: readonly McpServer[]): boolean {
  return servers.some(
    (server) =>
      server.enabled &&
      "endpoint" in server &&
      isCartaEndpoint(server.endpoint) &&
      mcpStatus(server) === "connected",
  );
}

/**
 * Creates the user's Carta agent when Carta is connected and the agent is missing. `ready` is false
 * until the bot list has loaded, so an existing agent is not mistaken for a missing one. When `create`
 * resolves to `false` (it failed), the next change of `botsVersion` (a bot list refresh) tries once
 * more. Carta may be connected later (the sign-in runs in another window), so the check also runs
 * again when the window regains focus while the agent is missing.
 */
export function useAutoCreateCartaAgent(
  ready: boolean,
  hasAgent: boolean,
  create: () => unknown,
  botsVersion?: unknown,
) {
  const started = useRef(false);
  const createRef = useRef(create);
  createRef.current = create;
  const [focusCount, setFocusCount] = useState(0);
  useEffect(() => {
    if (hasAgent) return;
    const onFocus = () => setFocusCount((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hasAgent]);
  useEffect(() => {
    if (!ready) {
      started.current = false;
      return;
    }
    if (hasAgent || started.current) return;
    started.current = true;
    rpc.mcp.servers
      .list()
      .then(async (servers) => {
        if (!hasConnectedCarta(servers) || (await createRef.current()) === false) {
          started.current = false;
        }
      })
      .catch(() => {
        started.current = false;
      });
  }, [ready, hasAgent, botsVersion, focusCount]);
}

import type { AppBootstrap } from "@rakazo/contracts";
import { initialBootstrapTarget } from "./bootstrap-target";
import { markOnce } from "./performance";
import { rpc } from "./rpc";

let ticketBoardEnabled = false;
const capabilityListeners = new Set<() => void>();
export function getTicketBoardEnabled() {
  return ticketBoardEnabled;
}
export function subscribeTicketBoardEnabled(listener: () => void) {
  capabilityListeners.add(listener);
  return () => {
    capabilityListeners.delete(listener);
  };
}

let primedBootstrap: { botId?: string; promise: Promise<AppBootstrap> } | null = null;

const initialTarget = initialBootstrapTarget(
  window.location.pathname,
  Boolean(window.rakazoDesktop),
);
if (initialTarget) {
  const { botId } = initialTarget;
  const promise = requestBootstrap(botId);
  // Authentication can redirect before Shell consumes this speculative request.
  // Register a rejection handler immediately while preserving rejection for a consumer.
  void promise.catch(() => undefined);
  primedBootstrap = { botId, promise };
}

/** The speculative first-load bootstrap, left in place for the shell to take. */
export function peekInitialBootstrap(): Promise<AppBootstrap> | undefined {
  return primedBootstrap?.promise;
}

/** A request that fails once (a dropped connection, a server still starting) is tried once more. */
export function takeInitialBootstrap(botId?: string) {
  const primed = primedBootstrap;
  primedBootstrap = null;
  const first = primed && primed.botId === botId ? primed.promise : requestBootstrap(botId);
  return first.catch(() => requestBootstrap(botId));
}

function requestBootstrap(botId?: string) {
  markOnce("rk:renderer:bootstrap-request-start");
  return rpc.bootstrap(botId ? { botId } : {}).then((bootstrap) => {
    markOnce("rk:renderer:bootstrap-response");
    ticketBoardEnabled = bootstrap.me.ticketBoardEnabled;
    for (const listener of capabilityListeners) listener();
    return bootstrap;
  });
}

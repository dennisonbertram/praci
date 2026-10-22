import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { AppContract } from "@rakazo/contracts";
import { LOCAL_SETTINGS_PAGE, LOCAL_SETTINGS_RPC } from "@rakazo/contracts";
import { desktopBridge } from "./desktop";

const SPACE_STORAGE_KEY = "rakazo:space-id";

type RpcClientContext = { spaceId?: string | null };

export function selectedSpaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function selectSpace(id: string): boolean {
  try {
    window.localStorage.setItem(SPACE_STORAGE_KEY, id);
    return true;
  } catch {
    try {
      // Write failed but the desired selection is already durable — treat as success.
      return window.localStorage.getItem(SPACE_STORAGE_KEY) === id;
    } catch {
      return false;
    }
  }
}

export function clearSpaceSelection(): void {
  try {
    window.localStorage.removeItem(SPACE_STORAGE_KEY);
  } catch {
    // Ignore storage failures on sign-out / reset paths.
  }
}

/** Adds `x-rakazo-space-id` when a space is selected. */
export function withSpaceHeaders(
  init?: HeadersInit,
  spaceId: string | null = selectedSpaceId(),
): Headers {
  const headers = new Headers(init);
  if (spaceId) headers.set("x-rakazo-space-id", spaceId);
  else headers.delete("x-rakazo-space-id");
  return headers;
}

/**
 * Read calls that several components issue at once (sidebar, thread refresh, toasts).
 * Identical calls made while one is in flight share its response.
 */
const COALESCED_PATHS = ["/bots/list", "/routines/list"];
const inFlight = new Map<string, Promise<Response>>();

export function coalescedFetch(
  request: Request,
  send: (request: Request) => Promise<Response>,
  body: string,
  spaceId: string | null,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!COALESCED_PATHS.some((suffix) => path.endsWith(suffix))) return send(request);
  const key = `${spaceId ?? ""}|${path}|${body}`;
  let pending = inFlight.get(key);
  if (!pending) {
    // Shared requests ignore per-caller abort signals so one caller cannot cancel the others.
    pending = send(
      new Request(request.url, { method: request.method, headers: request.headers, body }),
    ).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending.then((response) => response.clone());
}

const link = new RPCLink<RpcClientContext>({
  url: () =>
    typeof window === "undefined"
      ? "http://127.0.0.1:5173/rpc"
      : `${window.location.origin}${window.location.pathname === LOCAL_SETTINGS_PAGE ? LOCAL_SETTINGS_RPC : "/rpc"}`,
  fetch: async (input, init, options) => {
    const request = new Request(input, init);
    if (typeof window !== "undefined" && window.location.pathname === LOCAL_SETTINGS_PAGE) {
      const bridge = desktopBridge()?.localSettings;
      if (!bridge) throw new Error("Local settings require the desktop app");
      const result = await bridge.request(new URL(request.url).pathname, await request.text());
      return new Response(result.body, {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }
    const spaceId =
      options.context.spaceId === undefined ? selectedSpaceId() : options.context.spaceId;
    const send = (req: Request) =>
      fetch(req, {
        headers: withSpaceHeaders(req.headers, spaceId),
        credentials: "include",
      });
    if (request.method !== "POST") return send(request);
    return coalescedFetch(request, send, await request.clone().text(), spaceId);
  },
});

export const rpc: ContractRouterClient<AppContract, RpcClientContext> = createORPCClient(link);

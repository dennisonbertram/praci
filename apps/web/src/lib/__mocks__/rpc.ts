/**
 * Storybook stand-in for src/lib/rpc. Every `rpc.a.b(input)` call resolves to the response a story
 * registered with `mockRpc({ "a.b": value })`, or null. A function value is called with the input.
 * Responses reset before every story (see .storybook/preview.tsx).
 *
 * Vite can load this module twice (once as the stand-in for lib/rpc, once by its own path), so
 * the response table lives on globalThis and both copies share it.
 */
type Response = unknown | ((input: unknown) => unknown);

const store = globalThis as { __rakazoRpcMocks?: Map<string, Response> };
const responses = (store.__rakazoRpcMocks ??= new Map<string, Response>());

export function mockRpc(map: Record<string, Response>): void {
  for (const [key, value] of Object.entries(map)) responses.set(key, value);
}

export function resetRpcMocks(): void {
  responses.clear();
}

function node(path: string[]): unknown {
  return new Proxy(() => undefined, {
    get: (_target, key) => (key === "then" ? undefined : node([...path, String(key)])),
    apply: async (_target, _this, args: unknown[]) => {
      const value = responses.get(path.join("."));
      return typeof value === "function" ? value(args[0]) : (value ?? null);
    },
  });
}

// biome-ignore lint/suspicious/noExplicitAny: mirrors the real typed client for stories.
export const rpc = node([]) as any;

// The rest of lib/rpc's surface, so components that import it still load.
export function selectedSpaceId(): string | null {
  return null;
}

export function selectSpace(_id: string): boolean {
  return true;
}

export function clearSpaceSelection(): void {}

export function withSpaceHeaders(headers?: HeadersInit): Headers {
  return new Headers(headers);
}

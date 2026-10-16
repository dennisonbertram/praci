/**
 * Storybook stand-in for src/lib/rpc. Every `rpc.a.b(input)` call resolves to the response a story
 * registered with `mockRpc({ "a.b": value })`, or null. A function value is called with the input.
 * Responses reset before every story (see .storybook/preview.tsx).
 */
type Response = unknown | ((input: unknown) => unknown);

const responses = new Map<string, Response>();

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

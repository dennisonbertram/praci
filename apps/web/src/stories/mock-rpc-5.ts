import * as rpcModule from "../lib/rpc";

type MockRpc = (map: Record<string, unknown>) => void;

/**
 * Registers rpc responses for a story. In the Storybook build, `lib/rpc` is replaced by
 * `lib/__mocks__/rpc.ts`, and importing that file directly yields a second copy with its own
 * response table. Reading `mockRpc` off the mocked `lib/rpc` module reaches the table the app uses.
 */
export const mockRpc: MockRpc = (map) => (rpcModule as unknown as { mockRpc: MockRpc }).mockRpc(map);

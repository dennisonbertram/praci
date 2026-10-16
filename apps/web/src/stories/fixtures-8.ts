import * as mocked from "../lib/rpc";

type RpcMock = {
  mockRpc: (map: Record<string, unknown>) => void;
  resetRpcMocks: () => void;
};

/**
 * Registers rpc responses with the module the components actually import. In a built Storybook,
 * importing `mockRpc` from `lib/__mocks__/rpc` reaches a second copy of the mock with its own
 * response table, so the components never see the responses. `lib/rpc` is replaced by the mock
 * (`sb.mock`), so its namespace holds the live table. Resets first so responses never leak
 * between stories.
 */
export function mockRpc(map: Record<string, unknown>): void {
  const live = mocked as unknown as RpcMock;
  live.resetRpcMocks();
  live.mockRpc(map);
}

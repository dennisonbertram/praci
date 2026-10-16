import type * as rpcMock from "../lib/__mocks__/rpc";
import * as mocked from "../lib/rpc";

/**
 * `mockRpc` for this batch's stories. `build-storybook` bundles `__mocks__/rpc.ts` twice: once
 * behind `lib/rpc` (what components call) and once for a direct import, and the two keep separate
 * response maps, so a direct `mockRpc` never reaches a component. The namespace import reads the
 * copy components use. It also clears that copy first, so a story never sees another story's data.
 */
const copy = mocked as unknown as typeof rpcMock;

export function mockRpc(map: Parameters<typeof rpcMock.mockRpc>[0]): void {
  copy.resetRpcMocks();
  copy.mockRpc(map);
}

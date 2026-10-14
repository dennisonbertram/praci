import { afterEach, describe, expect, it, vi } from "vitest";
import { connectMcpOauth, MCP_OAUTH_CHANNEL } from "./mcp-connect";
import { rpc } from "./rpc";

vi.mock("./rpc", () => ({
  rpc: { mcp: { oauth: { begin: vi.fn() } } },
}));

describe("connectMcpOauth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("waits for completion when a COOP provider severs the popup handle", async () => {
    vi.useFakeTimers();
    vi.mocked(rpc.mcp.oauth.begin).mockResolvedValue({
      status: "authorization_required",
      authorizationUrl: "https://provider.example/authorize",
    } as never);
    const storage = new Map<string, string>();
    // A severed handle reads as closed even while the provider login is still open.
    const popup = {
      closed: true,
      close: vi.fn(),
      location: { href: "about:blank" },
      sessionStorage: { setItem: (key: string, value: string) => storage.set(key, value) },
    };
    vi.stubGlobal("window", {
      location: { origin: "http://127.0.0.1:5173" },
      open: vi.fn(() => popup),
      setTimeout,
      setInterval,
      clearInterval,
      clearTimeout,
    });

    const result = connectMcpOauth("server-id");
    await vi.advanceTimersByTimeAsync(5_000);
    new BroadcastChannel(MCP_OAUTH_CHANNEL).postMessage({ type: "mcp-oauth-complete" });

    await expect(result).resolves.toBe("connected");
    expect(popup.location.href).toBe("https://provider.example/authorize");
    expect([...storage.values()]).toEqual(["1"]);
  });
});

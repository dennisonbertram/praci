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

  it("closes the sign-in window when the attempt times out", async () => {
    vi.useFakeTimers();
    vi.mocked(rpc.mcp.oauth.begin).mockResolvedValue({
      status: "authorization_required",
      authorizationUrl: "https://provider.example/authorize",
    } as never);
    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: "about:blank" },
      sessionStorage: { setItem: vi.fn() },
    };
    vi.stubGlobal("window", {
      location: { origin: "http://127.0.0.1:5173" },
      open: vi.fn(() => popup),
      setTimeout,
      clearTimeout,
    });

    const result = connectMcpOauth("server-id");
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

    await expect(result).resolves.toBe("cancelled");
    expect(popup.close).toHaveBeenCalled();
  });

  it("asks the API for a fresh authorization when reauthorizing an already connected server", async () => {
    vi.mocked(rpc.mcp.oauth.begin).mockResolvedValue({ status: "already_connected" } as never);
    vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:5173" } });

    await expect(connectMcpOauth("server-id", { reauthorize: true })).resolves.toBe(
      "already_connected",
    );
    expect(rpc.mcp.oauth.begin).toHaveBeenLastCalledWith({
      serverId: "server-id",
      redirectUri: "http://127.0.0.1:5173/mcp/oauth/callback",
      reauthorize: true,
    });
  });

  it("does not ask for a fresh authorization on a plain connect", async () => {
    vi.mocked(rpc.mcp.oauth.begin).mockResolvedValue({ status: "already_connected" } as never);
    vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:5173" } });

    await connectMcpOauth("server-id");

    expect(vi.mocked(rpc.mcp.oauth.begin).mock.lastCall?.[0]).not.toHaveProperty("reauthorize");
  });
});

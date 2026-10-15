import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectFinanceProvider } from "./finance-connect";
import { openMcpOauthPopup } from "./mcp-connect";
import { rpc } from "./rpc";

vi.mock("./rpc", () => ({ rpc: { finance: { connect: vi.fn() } } }));
vi.mock("./mcp-connect", () => ({ openMcpOauthPopup: vi.fn() }));

describe("connectFinanceProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:5173" } });
  });

  it("opens the sign-in popup on the URL finance.connect returned", async () => {
    vi.mocked(rpc.finance.connect).mockResolvedValue({
      status: "authorization_required",
      serverId: "s1",
      sessionId: "o1",
      authorizationUrl: "https://login.example/authorize",
    });
    vi.mocked(openMcpOauthPopup).mockResolvedValue("connected");

    await expect(connectFinanceProvider("mercury")).resolves.toBe("connected");
    expect(rpc.finance.connect).toHaveBeenCalledWith({
      provider: "mercury",
      redirectUri: "http://127.0.0.1:5173/mcp/oauth/callback",
    });
    expect(openMcpOauthPopup).toHaveBeenCalledWith("https://login.example/authorize");
  });

  it("asks finance.connect to reauthorize on a reconnect", async () => {
    vi.mocked(rpc.finance.connect).mockResolvedValue({
      status: "already_connected",
      serverId: "s1",
    });
    await connectFinanceProvider("mercury", true);
    expect(rpc.finance.connect).toHaveBeenCalledWith({
      provider: "mercury",
      redirectUri: "http://127.0.0.1:5173/mcp/oauth/callback",
      reconnect: true,
    });
  });

  it("opens no popup when the server is already connected", async () => {
    vi.mocked(rpc.finance.connect).mockResolvedValue({
      status: "already_connected",
      serverId: "s1",
    });
    await expect(connectFinanceProvider("brex")).resolves.toBe("already_connected");
    expect(openMcpOauthPopup).not.toHaveBeenCalled();
  });

  it("passes a failed connect to the caller", async () => {
    vi.mocked(rpc.finance.connect).mockRejectedValue(new Error("boom"));
    await expect(connectFinanceProvider("brex")).rejects.toThrow("boom");
  });
});

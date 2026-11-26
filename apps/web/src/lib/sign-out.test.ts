import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  signOut: vi.fn(),
  clearTourStep: vi.fn(),
  clearAgentAppCache: vi.fn(),
  clearSpaceSelection: vi.fn(),
  enqueueNotificationToast: vi.fn(),
}));

vi.mock("./auth", () => ({ authClient: { signOut: m.signOut } }));
vi.mock("../components/tour/TourPopover", () => ({ clearTourStep: m.clearTourStep }));
vi.mock("./agent-app", () => ({ clearAgentAppCache: m.clearAgentAppCache }));
vi.mock("./rpc", () => ({ clearSpaceSelection: m.clearSpaceSelection }));
vi.mock("@rakazo/ui-web", () => ({ enqueueNotificationToast: m.enqueueNotificationToast }));

import { signOutAndLeave } from "./sign-out";

const navigate = vi.fn();

const expectStayed = () => {
  expect(navigate).not.toHaveBeenCalled();
  expect(m.clearSpaceSelection).not.toHaveBeenCalled();
  expect(m.clearAgentAppCache).not.toHaveBeenCalled();
  expect(m.clearTourStep).not.toHaveBeenCalled();
  expect(m.enqueueNotificationToast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Could not sign out. Try again." }),
  );
};

describe("signOutAndLeave", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears local state and goes to / on success", async () => {
    m.signOut.mockResolvedValue({ data: { success: true }, error: null });
    await signOutAndLeave(navigate, "u1");
    expect(m.clearTourStep).toHaveBeenCalledWith("u1");
    expect(m.clearAgentAppCache).toHaveBeenCalled();
    expect(m.clearSpaceSelection).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/");
    expect(m.enqueueNotificationToast).not.toHaveBeenCalled();
  });

  it("stays and shows a toast when the server returns an error", async () => {
    m.signOut.mockResolvedValue({ data: null, error: { status: 500, statusText: "x" } });
    await signOutAndLeave(navigate, "u1");
    expectStayed();
  });

  it("stays and shows a toast when the request throws", async () => {
    m.signOut.mockRejectedValue(new TypeError("Failed to fetch"));
    await signOutAndLeave(navigate, "u1");
    expectStayed();
  });
});

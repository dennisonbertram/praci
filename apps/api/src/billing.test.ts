import type { BillingProvider } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBillingService } from "./billing.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user@rakazo.test",
  isDeploymentOwner: false,
};
const price = { amount: 1000, currency: "usd", interval: "month" as const, intervalCount: 1 };

function service(getPrice: BillingProvider["getPrice"], role = "owner") {
  const prisma = {
    space: { findUnique: vi.fn().mockResolvedValue({ organizationId: "org-1" }) },
    member: {
      findUnique: vi.fn().mockResolvedValue({ role }),
      count: vi.fn().mockResolvedValue(3),
    },
    billingAccount: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient;
  const provider = { getPrice: vi.fn(getPrice) } as unknown as BillingProvider;
  return {
    provider,
    billing: createBillingService({ prisma, provider, webOrigin: "https://app.example.com" }),
  };
}

describe("billing status", () => {
  it("reads the price once and reuses it", async () => {
    const { billing, provider } = service(async () => price);
    await expect(billing.status(actor)).resolves.toMatchObject({ price, seats: 3 });
    await billing.status(actor);
    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });

  it("still answers when the price cannot be read", async () => {
    const { billing } = service(async () => {
      throw new Error("provider unavailable");
    });
    await expect(billing.status(actor)).resolves.toMatchObject({ price: null, access: false });
  });

  it("refuses checkout and portal for non-owners", async () => {
    const { billing } = service(async () => price, "member");
    await expect(billing.checkout(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(billing.portal(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("billing price lookup", () => {
  afterEach(() => vi.useRealTimers());

  it("does not retry a failed lookup for a minute", async () => {
    vi.useFakeTimers();
    const { billing, provider } = service(async () => {
      throw new Error("provider unavailable");
    });
    await billing.status(actor);
    await billing.status(actor);
    expect(provider.getPrice).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(61_000);
    await billing.status(actor);
    expect(provider.getPrice).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good price when a refresh fails", async () => {
    vi.useFakeTimers();
    const getPrice = vi.fn<BillingProvider["getPrice"]>().mockResolvedValueOnce(price);
    getPrice.mockRejectedValue(new Error("provider unavailable"));
    const { billing } = service(getPrice);
    await billing.status(actor);
    await vi.advanceTimersByTimeAsync(61 * 60 * 1000);
    await expect(billing.status(actor)).resolves.toMatchObject({ price });
  });

  it("answers without a price when the provider hangs", async () => {
    vi.useFakeTimers();
    const { billing } = service(() => new Promise(() => {}));
    const answer = billing.status(actor);
    await vi.advanceTimersByTimeAsync(5_001);
    await expect(answer).resolves.toMatchObject({ price: null });
  });

  it("shares one lookup between concurrent calls", async () => {
    const { billing, provider } = service(async () => price);
    await Promise.all([billing.status(actor), billing.status(actor)]);
    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });
});

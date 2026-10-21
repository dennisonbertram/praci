// @vitest-environment jsdom

import { beforeEach, expect, it, vi } from "vitest";

const bootstrap = vi.hoisted(() => vi.fn());
vi.mock("./rpc", () => ({ rpc: { bootstrap } }));
vi.mock("./performance", () => ({ markOnce: () => undefined }));

import { takeInitialBootstrap } from "./bootstrap";

const ok = { me: { ticketBoardEnabled: false } };

beforeEach(() => bootstrap.mockReset());

it("tries once more when the first request fails", async () => {
  bootstrap.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(ok);
  await expect(takeInitialBootstrap()).resolves.toBe(ok);
  expect(bootstrap).toHaveBeenCalledTimes(2);
});

it("gives up after the second failure", async () => {
  bootstrap.mockRejectedValueOnce(new Error("network")).mockRejectedValueOnce(new Error("again"));
  const result = await takeInitialBootstrap().then(
    () => "resolved",
    (error: Error) => error.message,
  );
  expect(result).toBe("again");
  expect(bootstrap).toHaveBeenCalledTimes(2);
});

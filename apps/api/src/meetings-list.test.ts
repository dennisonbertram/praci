import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rakazo/logging", () => ({
  getLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import type { MeetingsDeps } from "./meetings.js";
import { listStoredMeetings } from "./meetings.js";

const actor = { spaceId: "space-1", userId: "user-1" } as Actor;

const deps = (findMany: ReturnType<typeof vi.fn>) =>
  ({ router: { prisma: { meeting: { findMany } } } }) as unknown as MeetingsDeps;

describe("listStoredMeetings", () => {
  it("filters by attendee email, still scoped to the caller's space and user", async () => {
    const findMany = vi.fn(async () => []);
    await listStoredMeetings(deps(findMany), actor, undefined, {
      attendee: "ADA@example.test",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: "space-1",
          userId: "user-1",
          attendees: { array_contains: [{ email: "ada@example.test" }] },
        }),
      }),
    );
  });

  it("adds no attendee clause without the filter", async () => {
    const findMany = vi.fn(async () => []);
    await listStoredMeetings(deps(findMany), actor);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ attendees: expect.anything() }),
      }),
    );
  });
});

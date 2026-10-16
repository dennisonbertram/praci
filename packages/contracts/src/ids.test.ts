import { describe, expect, it } from "vitest";
import { actorScope } from "./ids.js";

describe("actorScope", () => {
  it("keeps only the space and user", () => {
    const actor = { userId: "u1", spaceId: "s1", email: "a@example.com", isDeploymentOwner: true };
    expect(actorScope(actor)).toEqual({ spaceId: "s1", userId: "u1" });
  });
});

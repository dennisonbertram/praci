import { expect, it, vi } from "vitest";
import { makeSpaceTheOnlyDefault } from "./seed.js";

it("clears the default flag on the cofounder's other spaces, never on the company", async () => {
  const updateMany = vi.fn(async () => ({ count: 1 }));
  await makeSpaceTheOnlyDefault({ space: { updateMany } } as never, "company", "cofounder");
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: { not: "company" }, memberships: { some: { userId: "cofounder" } } },
    data: { isDefault: false },
  });
});

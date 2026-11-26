import { vi } from "vitest";

/**
 * Fake `run.updateManyAndReturn` for `cancelRunsInTransaction`: returns `{ id }` for each requested
 * id the fake counts as active (every requested id when `activeIds` is omitted), like the real call.
 */
export function fakeRunUpdateManyAndReturn(activeIds?: ReadonlySet<string>) {
  return vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.filter((id) => !activeIds || activeIds.has(id)).map((id) => ({ id })),
  );
}

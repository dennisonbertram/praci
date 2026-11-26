/** Every row of a page-numbered list (pageSize at most 500), not just the first page. */
export async function listAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchPage(page);
    rows.push(...result.items);
    if (result.items.length === 0 || !(rows.length < result.total)) return rows;
  }
}

/** Every row of a cursor-paged list (the data room), following nextCursor to the end. */
export async function listAllCursor<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  do {
    const result = await fetchPage(cursor);
    rows.push(...result.items);
    cursor = result.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

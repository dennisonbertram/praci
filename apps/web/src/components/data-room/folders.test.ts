import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));

import { folderContents } from "./folders";

const folder = (id: string, parentId: string | null, itemCount = 0) => ({
  id,
  name: id,
  parentId,
  createdAt: "",
  itemCount,
});

it("says what a folder holds, counting sub-folders so a parent of folders is not 'Empty'", () => {
  const all = [
    folder("Finance", null, 2),
    folder("Invoices", "Finance", 1),
    folder("Archive", null),
  ];
  expect(folderContents(all[0] as never, all)).toBe("1 folder, 2 items");
  expect(folderContents(all[1] as never, all)).toBe("1 item");
  expect(folderContents(all[2] as never, all)).toBe("Empty");
});

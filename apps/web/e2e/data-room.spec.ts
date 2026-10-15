import { expect, type Locator, type Page, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

/** A synthetic ready item; the facets are made up. */
const readyItem = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  mimeType: "application/pdf",
  size: 120_000,
  folderId: null,
  source: "upload",
  status: "ready",
  error: null,
  facets: {
    docType: "Contract",
    docDate: "2026-10-03T00:00:00.000Z",
    parties: ["Acme Labs", "Example Property"],
    amountCents: 2_400_000,
    currency: "USD",
    tags: ["lease", "renewal"],
    summary: "Synthetic five-year renewal of an example office lease.",
  },
  createdAt: "2026-10-04T00:00:00.000Z",
  ...over,
});

const items = [
  readyItem(
    "c000000000000000000000001",
    "Example HQ lease renewal 2027 with a very long file name to test truncation of the name column.pdf",
  ),
  readyItem("c000000000000000000000002", "Series A term sheet v3.pdf", {
    source: "gmail",
    facets: {
      docType: "Contract",
      docDate: "2026-09-28T00:00:00.000Z",
      parties: ["Acme Labs"],
      amountCents: null,
      currency: null,
      tags: ["funding"],
      summary: "Synthetic draft term sheet.",
    },
  }),
  readyItem("c000000000000000000000003", "Board minutes Q2.pdf", {
    status: "failed",
    error: "Could not read this file",
    facets: {
      docType: null,
      docDate: null,
      parties: [],
      amountCents: null,
      currency: null,
      tags: [],
      summary: null,
    },
  }),
];

/** Answers the Data room RPCs with synthetic items and records what the page asked for. */
async function mockDataRoom(page: Page) {
  const calls: { name: string; input: Record<string, unknown> }[] = [];
  const uploaded: unknown[] = [];
  await page.route("**/rpc/dataRoom/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/dataRoom/")[1] ?? "";
    const input =
      (route.request().postDataJSON() as { json?: Record<string, unknown> } | null)?.json ?? {};
    calls.push({ name, input });
    const answers: Record<string, unknown> = {
      folders: [],
      "items/list": { items: [...items, ...uploaded], nextCursor: null },
      search: {
        results: [
          {
            item: items[0],
            ordinal: 0,
            snippet:
              "Either party may end the term with \u000190 days\u0002 notice <script>window.__pwned = 1</script>.",
            score: 1,
          },
        ],
        nextCursor: null,
      },
      item: uploaded[0] ?? items[0],
    };
    if (!(name in answers)) return route.fulfill({ status: 404, body: "not mocked" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: answers[name], meta: [] }),
    });
  });
  return { calls, uploaded };
}

const box = async (locator: Locator) => {
  const found = await locator.boundingBox();
  if (!found) throw new Error("element has no box");
  return found;
};

/** Dispatches a file drag on the window, the way a browser does for a drag from the desktop. */
async function dragFile(page: Page, type: "dragenter" | "dragleave" | "drop", name = "lease.txt") {
  await page.evaluate(
    ({ type, name }) => {
      const data = new DataTransfer();
      data.items.add(new File(["Synthetic lease text."], name, { type: "text/plain" }));
      window.dispatchEvent(
        new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
      );
    },
    { type, name },
  );
}

test("Data room lists, searches, previews and takes dropped files", async ({ page }, testInfo) => {
  const { calls, uploaded } = await mockDataRoom(page);
  await signup(page, `data-room-${Date.now()}@rakazo.test`, "password12", "Data Room User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-data-room").click();
  await expect(page).toHaveURL(/\/app\/data-room$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Data room", level: 1 })).toBeVisible();
  const list = page.getByTestId("data-room-list");
  const rows = list.locator("li[data-item-id]");
  await expect(rows).toHaveCount(3);

  // The first item is pinned and shown in the preview.
  const preview = page.getByTestId("data-room-preview");
  await expect(preview.getByRole("heading", { level: 3 })).toContainText("Example HQ lease");
  await expect(preview).toContainText("Synthetic five-year renewal");

  // Hovering another row shows it; a click pins it. A failed item shows its error.
  await rows.nth(1).hover();
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText("Series A term sheet v3.pdf");
  await rows.nth(2).click();
  await page.mouse.move(0, 0);
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText("Board minutes Q2.pdf");
  await expect(preview).toContainText("Could not read this file");
  // Arrow keys move the preview with the focus.
  await rows.nth(1).focus();
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText("Series A term sheet v3.pdf");
  await page.keyboard.press("ArrowUp");
  await expect(preview.getByRole("heading", { level: 3 })).toContainText("Example HQ lease");
  await rows.first().click();
  await rows.first().click();
  await expect(preview).toHaveCount(0);
  await rows.first().click();
  await expect(preview).toBeVisible();

  // Sort goes to the server and the order it returns is kept.
  await page.getByRole("button", { name: /^Sort/ }).click();
  await page.getByRole("menuitemradio", { name: "Name" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Name" })).toHaveCount(0);
  await expect
    .poll(() =>
      calls.some(
        (c) =>
          c.name === "items/list" &&
          JSON.stringify(c.input.sort) === JSON.stringify({ field: "name", direction: "desc" }),
      ),
    )
    .toBe(true);
  await expect(rows.first()).toContainText("Example HQ lease");

  // Search is sent to the server after typing pauses; a snippet is text plus <mark>, never HTML.
  await main.getByRole("searchbox", { name: "Search documents" }).fill("notice");
  await expect(list.locator("mark")).toHaveText("90 days");
  expect(calls.some((c) => c.name === "search" && c.input.query === "notice")).toBe(true);
  await expect(list).toContainText("<script>window.__pwned = 1</script>");
  expect(await page.evaluate(() => (window as { __pwned?: number }).__pwned)).toBeUndefined();
  await main.getByRole("searchbox", { name: "Search documents" }).fill("");
  await expect(rows).toHaveCount(3);

  // A dragged file shows the overlay; dropping it uploads to the Data room.
  await dragFile(page, "dragenter");
  await expect(page.getByTestId("data-room-drop-overlay")).toBeVisible();
  await dragFile(page, "dragleave");
  await expect(page.getByTestId("data-room-drop-overlay")).toHaveCount(0);
  const upload = page.waitForResponse((r) => r.url().includes("/api/data-room/upload"));
  await dragFile(page, "dragenter");
  await dragFile(page, "drop");
  const response = await upload;
  expect(response.status()).toBe(201);
  const { item } = (await response.json()) as { item: { id: string } };
  // The page reloads when an upload ends, which can be before the mock knows the new id.
  uploaded.push(readyItem(item.id, "lease.txt", { status: "pending" }));
  await page.evaluate(() => window.dispatchEvent(new Event("rakazo:data-room-changed")));
  const toast = page.getByTestId("data-room-toasts");
  await expect(toast).toContainText("lease.txt");
  await expect(toast).toContainText("Filed");
  await expect(toast.getByRole("link", { name: "View" })).toHaveAttribute(
    "href",
    `/app/data-room?item=${item.id}`,
  );
  // The stored bytes come back through the content route.
  const content = await page.request.get(`/api/data-room/items/${item.id}/content`);
  expect(await content.text()).toBe("Synthetic lease text.");
  await expect(rows).toHaveCount(4);

  // Layouts: the header cells never overlap and Name keeps its width, with the preview open.
  const layouts = [
    { name: "wide-1440", width: 1440, height: 900 },
    { name: "narrow-960", width: 960, height: 800 },
  ] as const;
  for (const layout of layouts.flatMap((l) =>
    (["light", "dark"] as const).map((scheme) => ({ ...l, scheme })),
  )) {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.emulateMedia({ colorScheme: layout.scheme });
    if ((await preview.count()) === 0) await rows.first().click();
    await expect(preview).toBeVisible();
    await expect(rows.first().getByTestId("data-room-name")).toBeVisible();

    const name = await box(rows.first().getByTestId("data-room-name"));
    expect(name.width).toBeGreaterThanOrEqual(160);
    const heads = page.getByTestId("data-room-head").locator(":scope > span");
    const shown: { x: number; width: number }[] = [];
    for (let i = 0; i < (await heads.count()); i++) {
      if (await heads.nth(i).isVisible()) shown.push(await box(heads.nth(i)));
    }
    shown.sort((a, b) => a.x - b.x);
    for (let i = 1; i < shown.length; i++) {
      const before = shown[i - 1];
      const after = shown[i];
      if (before && after) expect(before.x + before.width).toBeLessThanOrEqual(after.x + 0.5);
    }
    const pane = await box(list);
    // Nothing spills out of the list pane sideways.
    expect(await list.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    testInfo.annotations.push({
      type: layout.name,
      description: `${layout.scheme} list pane ${Math.round(pane.width)}px, name ${Math.round(name.width)}px`,
    });
    await captureScreenshot(page, testInfo, `data-room-${layout.name}-${layout.scheme}`);
  }
});

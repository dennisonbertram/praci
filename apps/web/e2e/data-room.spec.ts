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
      folders: [
        {
          id: "c0000000000000000000000f1",
          name: "Legal",
          parentId: null,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
        {
          id: "c0000000000000000000000f2",
          name: "Contracts",
          parentId: "c0000000000000000000000f1",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
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
      itemRetry: { ...items[2], status: "processing", error: null },
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
  const rows = list.locator("tr[data-item-id]");
  await expect(rows).toHaveCount(3);

  // Nothing is previewed until a file is chosen; a click on the first item shows it.
  const preview = page.getByTestId("data-room-preview");
  await expect(preview).toHaveCount(0);
  await rows.first().click();
  await expect(preview.getByRole("heading", { level: 3 })).toContainText("Example HQ lease");
  await expect(preview).toContainText("Synthetic five-year renewal");

  // Hovering another row leaves the preview alone; a click shows it. A failed item shows its error.
  await rows.nth(1).hover();
  await page.waitForTimeout(300);
  await expect(preview.getByRole("heading", { level: 3 })).toContainText("Example HQ lease");
  await rows.nth(2).click();
  await page.mouse.move(0, 0);
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText("Board minutes Q2.pdf");
  await expect(preview).toContainText("Could not read this file");
  // Arrow keys move the preview with the focus.
  await page.keyboard.press("ArrowUp");
  await expect(preview.getByRole("heading", { level: 3 })).toHaveText("Series A term sheet v3.pdf");
  await page.keyboard.press("ArrowUp");
  await expect(preview.getByRole("heading", { level: 3 })).toContainText("Example HQ lease");
  // Clicking the row that is shown closes the pane; clicking it again opens it.
  await rows.first().click();
  await expect(preview).toHaveCount(0);
  await rows.first().click();
  await expect(preview.getByRole("heading", { level: 3 })).toContainText("Example HQ lease");

  // Sort goes to the server and the order it returns is kept.
  await page.getByRole("button", { name: /^Sort/ }).click();
  await page.getByRole("menuitemradio", { name: "Name" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Name" })).toHaveCount(0);
  await expect
    .poll(() =>
      calls.some(
        (c) =>
          c.name === "items/list" &&
          JSON.stringify(c.input.sort) === JSON.stringify({ field: "name", direction: "asc" }),
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
  await expect(toast).toContainText("Uploaded");
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
    const heads = page.getByTestId("data-room-head").locator("th");
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

  // A pinned item that is not in the search results closes the preview and no result is chosen for
  // the user; the Source menu
  // closes when a file is dragged in, and the overlay covers the page; the toast's link is visible.
  const searchbox = main.getByRole("searchbox", { name: "Search documents" });
  for (const width of [1440, 960]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 });
    await rows.nth(1).click();
    await expect(preview.getByRole("heading", { level: 3 })).toHaveText(
      "Series A term sheet v3.pdf",
    );
    await searchbox.fill("notice");
    await expect(list.locator("mark")).toHaveText("90 days");
    await expect(preview).toHaveCount(0);
    await rows.first().click();
    await expect(preview.getByRole("heading", { level: 3 })).toContainText("Example HQ lease");
    await captureScreenshot(page, testInfo, `v2-search-${width}`);
    await searchbox.fill("");
    await expect(rows).toHaveCount(4);

    await page.getByRole("button", { name: "Filter by Source" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Gmail" })).toBeVisible();
    await dragFile(page, "dragenter");
    await expect(page.getByTestId("data-room-drop-overlay")).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: "Gmail" })).toHaveCount(0);
    // The overlay uses the app's top layer, above menus and dialogs (z-50).
    const layer = await page
      .getByTestId("data-room-drop-overlay")
      .evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(layer).toBeGreaterThan(50);
    await captureScreenshot(page, testInfo, `v2-overlay-${width}`);
    await dragFile(page, "dragleave");

    await dragFile(page, "dragenter");
    await dragFile(page, "drop");
    const link = page.getByTestId("data-room-toasts").getByRole("link", { name: "View" }).last();
    await expect(link).toBeVisible();
    const at = await box(link);
    const viewport = page.viewportSize();
    expect(at.x + at.width).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(at.y + at.height).toBeLessThanOrEqual(viewport?.height ?? 0);
    // The list reloads once the upload lands and may return focus to the open row, so focus the
    // link again until it holds.
    await expect(async () => {
      await link.focus();
      await expect(link).toBeFocused({ timeout: 1_000 });
    }).toPass();
    await captureScreenshot(page, testInfo, `v2-toast-${width}`);
  }

  // A narrow page: the folder picker replaces the tree, and the preview opens in a dialog only on
  // click, with focus inside it and back on the row afterwards.
  await page.setViewportSize({ width: 480, height: 800 });
  await page.reload();
  await expect(rows).toHaveCount(4);
  const picker = page.getByTestId("data-room-folder-picker");
  await expect(picker).toBeVisible();
  await expect(page.getByRole("tree", { name: "Folders" })).toBeHidden();
  await picker.click();
  await expect(page.getByRole("menuitemradio", { name: "Legal / Contracts" })).toBeVisible();
  await captureScreenshot(page, testInfo, "v3-folder-picker-480");
  await page.getByRole("menuitemradio", { name: "Legal / Contracts" }).click();
  // The trigger shows the folder's own name; its title carries the full path.
  await expect(picker).toContainText("Contracts");
  await expect(picker).toHaveAttribute("title", "Legal / Contracts");
  await expect
    .poll(() => calls.some((c) => c.input.folderId === "c0000000000000000000000f2"))
    .toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await rows.nth(1).hover();
  await page.waitForTimeout(400);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await rows.nth(1).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Series A term sheet v3.pdf");
  await expect(sheet.locator(":focus")).toHaveCount(1);
  await captureScreenshot(page, testInfo, "v3-preview-sheet-480");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(rows.nth(1)).toBeFocused();

  // A phone: search on its own line, the folder picker and Sort in one row, the filters on a row
  // below, and no page scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  const type = page.getByRole("button", { name: "Filter by Type" });
  const sortButton = page.getByRole("button", { name: /^Sort:/ });
  await expect(type).toBeVisible();
  await expect(sortButton).toBeVisible();
  const pickerBox = await page.getByTestId("data-room-folder-picker").boundingBox();
  const typeBox = await type.boundingBox();
  const sortBox = await sortButton.boundingBox();
  expect(Math.abs((sortBox?.y ?? 0) - (pickerBox?.y ?? 100))).toBeLessThan(2);
  expect(typeBox?.y ?? 0).toBeGreaterThan((sortBox?.y ?? 0) + (sortBox?.height ?? 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("Data room imports a mail attachment through the picker", async ({ page }, testInfo) => {
  const { calls } = await mockDataRoom(page);
  const json = (body: unknown) => ({
    contentType: "application/json",
    body: JSON.stringify({ json: body, meta: [] }),
  });
  await page.route("**/rpc/connections/list", (route) =>
    route.fulfill(
      json([
        {
          id: "c0000000000000000000000c1",
          connectorId: "google",
          provider: "gmail",
          displayName: "Example mail",
          status: "connected",
        },
      ]),
    ),
  );
  await page.route("**/rpc/inbox/list", (route) =>
    route.fulfill(
      json({
        accounts: [],
        agent: null,
        rows: [
          {
            id: "c0000000000000000000000m1",
            connectionId: "c0000000000000000000000c1",
            threadId: "t1",
            from: "Example Billing <billing@example.com>",
            subject: "Invoice 1042",
            snippet: "",
            receivedAt: "2026-10-10T00:00:00.000Z",
            unread: false,
            inInbox: true,
            needsReply: null,
            priority: null,
            reason: null,
            category: null,
            feedback: null,
          },
        ],
        syncedAt: null,
        failedAccounts: [],
        reconnectAccounts: [],
        enabled: false,
        triageBlocked: null,
        triagePending: false,
      }),
    ),
  );
  await page.route("**/rpc/inbox/get", (route) =>
    route.fulfill(
      json({
        from: "Example Billing <billing@example.com>",
        to: "me@example.com",
        cc: "",
        date: "2026-10-10T00:00:00.000Z",
        subject: "Invoice 1042",
        html: null,
        text: "Synthetic invoice.",
        attachments: [
          { id: "att1", filename: "invoice-1042.pdf", mimeType: "application/pdf", size: 52_000 },
        ],
      }),
    ),
  );
  await page.route("**/rpc/dataRoom/importEmail", (route) =>
    route.fulfill(json({ imported: 1, duplicates: 0, failed: 0 })),
  );

  await signup(page, `data-room-mail-${Date.now()}@rakazo.test`, "password12", "Data Room User");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-data-room").click();
  await expect(page.getByTestId("data-room-list").locator("tr[data-item-id]")).toHaveCount(3);

  await page.getByRole("button", { name: "Import from email" }).click();
  const dialog = page.getByRole("dialog", { name: "Import from email" });
  await expect(dialog.getByPlaceholder("Search mail")).toBeVisible();
  await dialog.getByRole("button", { name: /Invoice 1042/ }).click();
  await dialog.getByRole("checkbox", { name: "invoice-1042.pdf" }).click();
  await captureScreenshot(page, testInfo, "data-room-import-email");
  await dialog.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.getByRole("status").filter({ hasText: "Imported 1 file" })).toBeVisible();
  // The list reloads so the new item shows up.
  await expect.poll(() => calls.filter((c) => c.name === "items/list").length).toBeGreaterThan(1);
});

test("Data room imports a Google Drive file through the picker", async ({ page }, testInfo) => {
  const { calls } = await mockDataRoom(page);
  const json = (body: unknown) => ({
    contentType: "application/json",
    body: JSON.stringify({ json: body, meta: [] }),
  });
  await page.route("**/rpc/connections/list", (route) =>
    route.fulfill(
      json([
        {
          id: "c0000000000000000000000d1",
          connectorId: "google",
          provider: "googledrive",
          displayName: "Example drive",
          status: "connected",
        },
      ]),
    ),
  );
  await page.route("**/rpc/dataRoom/driveList", (route) =>
    route.fulfill(
      json({
        files: [
          {
            id: "dir1",
            name: "Contracts",
            mimeType: "application/vnd.google-apps.folder",
            isFolder: true,
          },
          {
            id: "doc1",
            name: "Quarterly plan",
            mimeType: "application/vnd.google-apps.document",
            isFolder: false,
          },
        ],
      }),
    ),
  );
  await page.route("**/rpc/dataRoom/importDrive", (route) =>
    route.fulfill(json({ imported: 1, duplicates: 0, failed: 0 })),
  );

  await signup(page, `data-room-drive-${Date.now()}@rakazo.test`, "password12", "Data Room User");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-data-room").click();
  await expect(page.getByTestId("data-room-list").locator("tr[data-item-id]")).toHaveCount(3);

  await page.getByRole("button", { name: "Import from Google Drive" }).click();
  const dialog = page.getByRole("dialog", { name: "Import from Google Drive" });
  await expect(dialog.getByPlaceholder("Search Drive")).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Quarterly plan" }).click();
  await captureScreenshot(page, testInfo, "data-room-import-drive");
  await dialog.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.getByRole("status").filter({ hasText: "Imported 1 file" })).toBeVisible();
  await expect.poll(() => calls.filter((c) => c.name === "items/list").length).toBeGreaterThan(1);
});

const json = (body: unknown) => ({
  contentType: "application/json",
  body: JSON.stringify({ json: body, meta: [] }),
});
const GOOGLE_APPS = [
  { connectorId: "google", slug: "gmail" },
  { connectorId: "google", slug: "googledrive" },
];

async function openDataRoom(page: Page, catalog: unknown[] = GOOGLE_APPS) {
  await page.route("**/rpc/connections/list", (route) => route.fulfill(json([])));
  await page.route("**/rpc/connections/catalog", (route) => route.fulfill(json(catalog)));
  await signup(page, `data-room-vis12-${Date.now()}@rakazo.test`, "password12", "Data Room User");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-data-room").click();
  await expect(page.getByTestId("data-room-list").locator("tr[data-item-id]")).toHaveCount(3);
}

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
] as const;

test("Data room header has one primary action, a visible New folder, and no sideways overflow", async ({
  page,
}, testInfo) => {
  await mockDataRoom(page);
  await openDataRoom(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const add = page.getByRole("button", { name: "Add files" }).first();
    await expect(add).toBeVisible();

    // Exactly one header button has the primary fill (compared with a probe that uses bg-primary).
    const header = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.className = "bg-primary";
      document.body.append(probe);
      const primary = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const bar = Array.from(document.querySelectorAll("h1")).find(
        (h) => h.textContent === "Data room",
      )?.parentElement?.parentElement;
      const buttons = Array.from(bar?.querySelectorAll("button") ?? []).filter(
        (b) => b.getBoundingClientRect().width > 0,
      );
      const rects = buttons.map((b) => b.getBoundingClientRect().toJSON());
      return {
        filled: buttons
          .filter((b) => getComputedStyle(b).backgroundColor === primary)
          .map((b) => b.getAttribute("aria-label") ?? b.textContent),
        count: buttons.length,
        rects,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(header.filled, `${viewport.width}px filled controls`).toHaveLength(1);
    expect(header.filled[0]).toContain("Add files");
    expect(header.overflowX).toBeLessThanOrEqual(0);
    // No two header controls overlap.
    for (let i = 0; i < header.rects.length; i++) {
      for (let j = i + 1; j < header.rects.length; j++) {
        const a = header.rects[i];
        const b = header.rects[j];
        if (!a || !b) continue;
        const apart =
          a.right <= b.left + 0.5 ||
          b.right <= a.left + 0.5 ||
          a.bottom <= b.top + 0.5 ||
          b.bottom <= a.top + 0.5;
        expect(apart, `${viewport.width}px header controls ${i} and ${j} overlap`).toBe(true);
      }
    }

    if (viewport.width < 800) {
      const newFolder = page.getByRole("button", { name: "New folder" });
      await expect(newFolder).toBeVisible();
      const at = await box(newFolder);
      expect(at.width).toBeGreaterThanOrEqual(32);
      expect(at.height).toBeGreaterThanOrEqual(32);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x + at.width).toBeLessThanOrEqual(viewport.width);
      expect(at.y + at.height).toBeLessThanOrEqual(viewport.height);
      await newFolder.click();
      await expect(page.getByRole("dialog", { name: /New folder/ })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await captureScreenshot(page, testInfo, `data-room-header-${viewport.width}`);
  }
});

test("Data room failed row retries in place, and columns stay put as a file settles", async ({
  page,
}) => {
  const { calls } = await mockDataRoom(page);
  let settled = false;
  await page.route("**/rpc/dataRoom/items/list", (route) =>
    route.fulfill(
      json({
        items: items.map((i) => (i === items[1] && !settled ? { ...i, status: "processing" } : i)),
        nextCursor: null,
      }),
    ),
  );
  await openDataRoom(page);
  const retries = () => calls.filter((c) => c.name === "itemRetry").length;
  const failed = page.locator('tr[data-item-id="c000000000000000000000003"]');

  for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
    await page.setViewportSize(viewport);
    const before = retries();
    const retry = failed.getByRole("button", { name: "Try again" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect.poll(retries).toBe(before + 1);
    // The click is on the button alone: the preview stays closed.
    await expect(page.getByTestId("data-room-preview")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  // Header cells keep their x and width when the processing file becomes ready.
  for (const viewport of [VIEWPORTS[0], VIEWPORTS[1]]) {
    settled = false;
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.dispatchEvent(new Event("rakazo:data-room-changed")));
    const status = page.locator("tr[data-item-id] [data-testid=data-room-status]");
    await expect(status.filter({ hasText: "Reading" })).toHaveCount(1);
    const cells = async () =>
      page
        .getByTestId("data-room-head")
        .locator("th")
        .evaluateAll((cells) =>
          cells.map((span) => {
            const r = span.getBoundingClientRect();
            return [Math.round(r.x * 10) / 10, Math.round(r.width * 10) / 10];
          }),
        );
    const shapeBefore = await cells();
    settled = true;
    await page.evaluate(() => window.dispatchEvent(new Event("rakazo:data-room-changed")));
    await expect(status.filter({ hasText: "Reading" })).toHaveCount(0);
    expect(await cells()).toEqual(shapeBefore);
    // The Type cell never carries a status word.
    await expect(page.locator("tr[data-item-id]").first()).not.toContainText("Reading");
  }
});

test("Data room Date column follows the sort", async ({ page }) => {
  await mockDataRoom(page);
  await openDataRoom(page);
  await page.setViewportSize(VIEWPORTS[0]);
  const head = page.getByTestId("data-room-head");
  const firstDate = page.locator("tr[data-item-id]").first().locator(":scope > td").nth(2);
  await expect(head).toContainText("Added");
  await expect(firstDate).toHaveText("Oct 4, 2026");
  await page.getByRole("button", { name: /^Sort:/ }).click();
  await page.getByRole("menuitemradio", { name: "Document date" }).click();
  await expect(head).toContainText("Document date");
  await expect(firstDate).toHaveText("Oct 3, 2026");
});

test("Data room imports only appear for apps the server offers", async ({ page }) => {
  await mockDataRoom(page);
  await openDataRoom(page, []);
  await page.setViewportSize(VIEWPORTS[0]);
  await expect(page.getByRole("button", { name: "Add files" }).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Connect Google Drive|Import from Google Drive/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Connect Gmail|Import from email/ })).toHaveCount(
    0,
  );

  // With the apps offered (but not connected) the buttons are back and still lead to the app page.
  await page.unroute("**/rpc/connections/catalog");
  await page.route("**/rpc/connections/catalog", (route) => route.fulfill(json(GOOGLE_APPS)));
  await page.reload();
  const drive = page.getByRole("button", { name: "Connect Google Drive" });
  await expect(drive).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  await drive.click();
  await expect(page).toHaveURL(/\/app\/integrations\/app\/google\/googledrive$/);
});

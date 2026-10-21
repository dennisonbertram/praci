import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

const now = "2026-10-01T09:00:00.000Z";
const contactRow = (id: string, name: string) => ({
  id,
  name,
  email: `${name.toLowerCase()}@example.test`,
  organization: null,
  kind: "investor",
  notes: null,
  addedBy: null,
  createdAt: now,
  updatedAt: now,
});

/** Answers the update RPCs with synthetic data; sign-up and the rest of the app are the real stack. */
async function mockUpdates(page: Page) {
  const calls: { name: string; input: unknown }[] = [];
  let status: "draft" | "sending" | "sent" = "draft";
  const update = () => ({
    id: "upd1",
    audience: "investors",
    subject: "Example Co · 2026-09 update",
    period: "2026-09",
    body: "## Highlights\n\n- Shipped the first release\n- Hired two engineers\n\n## Asks\n\nIntroductions to seed investors.",
    status,
    recipientContactIds: ["c1", "c2"],
    fromConnectionId: null,
    deliveries:
      status === "draft"
        ? []
        : [
            { contactId: "c1", name: "Ada", state: "sent" },
            { contactId: "c2", name: "Bo", state: status === "sent" ? "sent" : "sending" },
          ],
    sentAt: status === "draft" ? null : now,
    createdAt: now,
    updatedAt: now,
  });
  await page.route("**/rpc/contacts/list", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: [contactRow("c1", "Ada"), contactRow("c2", "Bo")], meta: [] }),
    }),
  );
  await page.route("**/rpc/investors/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/investors/")[1] ?? "";
    const input = (route.request().postDataJSON() as { json?: unknown } | null)?.json;
    calls.push({ name, input });
    if (name === "updates/send") status = "sending";
    // The next read after Send finds the send finished.
    if (name === "updates/get" && status === "sending") status = "sent";
    const answers: Record<string, unknown> = {
      agent: null,
      capTable: { snapshot: null, syncing: false },
      reminder: { cadence: "monthly" },
      "updates/list": [update()],
      "updates/get": update(),
      "updates/save": update(),
      "updates/send": update(),
      "updates/accounts": [{ connectionId: "g1", label: "founder@example.test" }],
    };
    if (!(name in answers)) return route.fulfill({ status: 404, body: "not mocked" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: answers[name], meta: [] }),
    });
  });
  return calls;
}

test("A draft update waits in Action items, opens in the editor and sends", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const calls = await mockUpdates(page);
  await signup(page, `updates-${Date.now()}@rakazo.test`, "password12", "Updates User");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-investors").click();
  const main = page.getByRole("main");
  const items = main.getByRole("region", { name: "Action items" });
  await expect(items.getByText("Example Co · 2026-09 update")).toBeVisible();
  await expect(
    main.getByRole("region", { name: "Updates" }).getByText("Draft", { exact: true }),
  ).toBeVisible();

  await items.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/app\/investors\/updates\/upd1$/);
  await expect(main.getByLabel("Subject")).toHaveValue("Example Co · 2026-09 update");
  await expect(main.getByText("Shipped the first release")).toBeVisible();
  await expect(main.getByLabel("From")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "investors-update");

  await main.getByRole("button", { name: "Send", exact: true }).click();
  await expect.poll(() => calls.some((c) => c.name === "updates/send")).toBe(true);
  // The finished send returns to Investors with a toast.
  await expect(page).toHaveURL(/\/app\/investors$/);
  await expect(page.getByRole("alert").getByText("Sent to 2")).toBeVisible();
});

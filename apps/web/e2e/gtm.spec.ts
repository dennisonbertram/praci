import { expect, test } from "@playwright/test";
import { agentPageContent, page as gtmPage, item, overview } from "../src/pages/gtm/fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("GTM opens its plan and docked agent on desktop and phone", async ({ page }, testInfo) => {
  let currentPage = gtmPage;
  await page.setViewportSize({ width: 1440, height: 1000 });
  const scheduled = new Date();
  scheduled.setHours(12, 0, 0, 0);
  const scheduledFor = scheduled.toISOString();
  const previewOverview = {
    ...overview,
    gmailAccounts: [{ connectionId: "gmail_demo", label: "Demo Gmail" }],
    groups: {
      ...overview.groups,
      needs_you: [
        { ...item, scheduledFor },
        {
          ...item,
          id: "linkedin_demo",
          channel: "linkedin",
          title: "Design partner program",
          scheduledFor,
        },
        {
          ...item,
          id: "email_demo",
          category: "outbound_email",
          channel: "email",
          title: "Synthetic email preview",
          target: "prospect@example.test",
          notes: "Join our beta.\nReply unsubscribe to stop these emails.",
          scheduledFor,
        },
      ],
    },
    counts: { ...overview.counts, needs_you: 3 },
  };
  await page.route("**/rpc/gtm/overview", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: previewOverview, meta: [] }),
    }),
  );
  await page.route("**/rpc/gtm/queue", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: {
          status: "ready",
          complete: true,
          posts: [
            {
              id: "provider_demo",
              content: "Published synthetic queue entry",
              scheduledFor,
              status: "published",
              platforms: [
                {
                  platform: "twitter",
                  accountId: "account_demo",
                  status: "published",
                  platformPostUrl: "https://x.com/example/status/123",
                },
              ],
            },
          ],
        },
        meta: [],
      }),
    }),
  );
  await page.route("**/rpc/inbox/compose/send", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: { status: "disabled" }, meta: [] }),
    }),
  );
  await page.route("**/rpc/pages/get", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: currentPage, meta: [] }),
    }),
  );
  await page.route("**/rpc/pages/save", (route) => {
    const input = route.request().postDataJSON().json;
    currentPage = { ...currentPage, content: input.content, revision: input.baseRevision + 1 };
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: { ok: true, page: currentPage }, meta: [] }),
    });
  });
  await signup(page, `gtm-${Date.now()}@rakazo.test`, "password12", "GTM Demo");
  await completeOnboarding(page);
  const skipTour = page.getByRole("button", { name: "Skip tour", exact: true });
  if (await skipTour.isVisible()) await skipTour.click();
  await page.getByTestId("sidebar-gtm").click();
  await expect(page).toHaveURL(/\/app\/gtm$/);
  await expect(page.getByRole("heading", { name: "GTM", exact: true })).toBeVisible();
  await expect(page.getByTestId("gtm-agent-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Needs you/ })).toBeVisible();
  await expect(page.getByText("Find our first 50 design partners", { exact: true })).toBeVisible();
  await expect(page.getByText("Link counts as 23", { exact: true })).toBeVisible();
  await expect(page.locator('[data-item-id="linkedin_demo"]')).toContainText("/ 3,000");
  await captureScreenshot(page, testInfo, "gtm-plan-desktop");
  const emailCard = page.locator('[data-item-id="email_demo"]');
  await emailCard.scrollIntoViewIfNeeded();
  await expect(emailCard.getByRole("button", { name: "Approve", exact: true })).toBeDisabled();
  await captureScreenshot(page, testInfo, "gtm-email-desktop");
  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await expect(page.getByTestId("gtm-calendar-grid")).toBeVisible();
  await expect(page.getByTestId("gtm-calendar-grid")).toContainText(
    "Published synthetic queue entry",
  );
  await expect(page.getByTestId("gtm-calendar-grid")).not.toContainText("Synthetic email preview");
  await captureScreenshot(page, testInfo, "gtm-calendar-desktop");
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.getByTestId("gtm-calendar-grid")).toBeHidden();
  await expect(page.getByTestId("gtm-calendar-agenda")).toBeVisible();
  await captureScreenshot(page, testInfo, "gtm-calendar-phone");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ask GTM agent" })).toBeVisible();
  await expect(page.getByTestId("gtm-agent-panel")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await captureScreenshot(page, testInfo, "gtm-plan-phone");
  await emailCard.scrollIntoViewIfNeeded();
  await captureScreenshot(page, testInfo, "gtm-email-phone");
  currentPage = { ...gtmPage, content: agentPageContent };
  previewOverview.groups.in_progress = [
    { ...item, id: "uncertain_demo", status: "open", proof: `post:demo:${"a".repeat(64)}` },
  ];
  await page.reload();
  const blocks = page.locator("[data-gtm-block]");
  await expect(blocks).toHaveCount(3);
  await expect(page.locator('[data-item-id="uncertain_demo"]')).toContainText(
    "Posting may have failed",
  );
  expect(
    await page
      .locator('[data-item-id="uncertain_demo"]')
      .evaluate((node) =>
        Boolean(
          node.compareDocumentPosition(document.querySelector("[data-gtm-block]")!) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
  ).toBe(true);
  await blocks.first().scrollIntoViewIfNeeded();
  await captureScreenshot(page, testInfo, "gtm-agent-layout-phone");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await captureScreenshot(page, testInfo, "gtm-agent-layout-desktop");
  await blocks.first().getByRole("button", { name: "Move down", exact: true }).click();
  await expect(blocks.first()).toHaveAttribute("data-gtm-block", "gtm-plan");
  for (let remaining = 3; remaining > 0; remaining--) {
    await blocks.first().getByRole("button", { name: "Delete block", exact: true }).click();
    await expect(blocks).toHaveCount(remaining - 1);
  }
  await expect(page.getByRole("heading", { name: /In progress/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Drafts for you/ })).toBeVisible();
});

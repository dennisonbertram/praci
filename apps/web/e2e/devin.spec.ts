import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { overview } from "../src/pages/devin/fixtures";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

/** Answers the Devin RPCs and the sidebar glance with synthetic data; the rest is the real stack. */
async function mockDevin(page: Page, sessions = overview.sessions) {
  await page.route("**/rpc/devin/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/rpc/devin/")[1] ?? "";
    const answers: Record<string, unknown> = {
      sessions: { ...overview, sessions },
      agent: null,
    };
    if (!(name in answers)) return route.fulfill({ status: 404, body: "not mocked" });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ json: answers[name], meta: [] }),
    });
  });
  await page.route("**/rpc/notifications/glance", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: {
          financeRunwayMonths: null,
          legalDueSoon: 0,
          devinNeedsYou: 3,
          devinConnected: true,
          dataRoomWaiting: 0,
          botKinds: {},
        },
        meta: [],
      }),
    }),
  );
}

test("Devin shows the sidebar count, the sessions, and the agent panel only after Ask", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await mockDevin(page);
  await signup(page, `devin-${Date.now()}@rakazo.test`, "password12", "Devin User");
  await completeOnboarding(page);

  const link = page.getByTestId("sidebar-devin");
  await expect(link).toContainText("Devin");
  await expect(link).toContainText("3");
  await link.click();
  await expect(page).toHaveURL(/\/app\/devin$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Devin", level: 1 })).toBeVisible();
  await expect(
    main.getByRole("link", { name: /Add retry limit to the export worker/ }),
  ).toHaveAttribute("href", "https://app.devin.ai/sessions/devin-1001");
  await expect(page.getByTestId("devin-agent-panel")).toBeHidden();
  await captureScreenshot(page, testInfo, "devin-sessions");

  await main.getByRole("button", { name: /Ask/ }).click();
  await expect(page.getByTestId("devin-agent-panel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Collapse Devin agent" })).toBeVisible();
  await captureScreenshot(page, testInfo, "devin-agent-panel");
});

test("Devin wraps a long question and shows the compact list on a phone", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const question =
    "Should the retry limit live in the API config or stay a constant in the worker, given two callers disagree?";
  expect(question.length).toBeGreaterThanOrEqual(100);
  await mockDevin(
    page,
    overview.sessions.map((session) =>
      session.kind === "needs_you" ? { ...session, question } : session,
    ),
  );
  await signup(page, `devin-phone-${Date.now()}@rakazo.test`, "password12", "Devin User");
  await completeOnboarding(page);
  await page.goto("/app/devin");

  const main = page.getByRole("main");
  const text = main.locator("p:visible", { hasText: question });
  await expect(text).toBeVisible();
  const layout = await text.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      lines: element.getBoundingClientRect().height / Number.parseFloat(style.lineHeight),
      textOverflow: style.textOverflow,
    };
  });
  expect(layout.lines).toBeGreaterThan(1.5);
  expect(layout.textOverflow).not.toBe("ellipsis");
  await expect(main.getByRole("table")).toBeHidden();
  await expect(main.getByRole("list").first()).toBeVisible();
  await captureScreenshot(page, testInfo, "devin-phone");
});

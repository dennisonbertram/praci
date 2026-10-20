import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, finishConnectDialog, rpc, signup } from "./helpers";

const api = () => process.env.API_URL ?? "http://127.0.0.1:3110";

test.use({ timezoneId: "America/Los_Angeles", locale: "en-US" });

async function openInbox(page: Page, name: string) {
  await signup(page, `${name}-${Date.now()}@rakazo.test`, "password12", "Preview User");
  await completeOnboarding(page);
  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  // Connect mail opens Gmail's own connect dialog, then returns to the Inbox.
  await page.getByRole("dialog").getByRole("button", { name: "Connect", exact: true }).click();
  await finishConnectDialog(page, "Gmail");
  await expect(page).toHaveURL(/\/app\/inbox$/);
}

test("the preview shows Cc and keeps a long link and an HTML frame inside the dialog", async ({
  page,
}, testInfo) => {
  await openInbox(page, "preview");
  const main = page.getByRole("main");

  await main.getByRole("button", { name: /Long link/ }).click();
  const dialog = page.getByRole("dialog");
  const text = dialog.locator("p.wrap-anywhere");
  await expect(text).toContainText("segment");
  const fits = await text.evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits).toBe(true);
  await captureScreenshot(page, testInfo, "preview-long-link");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await main.getByRole("button", { name: /Team sync notes/ }).click();
  await expect(dialog.getByText("cc Team <team@example.test>")).toBeVisible();
  await expect(dialog.getByText(/^to first@example.test/)).toBeVisible();
  const frame = dialog.locator("iframe");
  await expect(frame).toBeVisible();
  const [frameBox, dialogBox] = await Promise.all([frame.boundingBox(), dialog.boundingBox()]);
  // The frame ends inside the dialog, above its bottom padding.
  expect((frameBox?.y ?? 0) + (frameBox?.height ?? 0)).toBeLessThanOrEqual(
    (dialogBox?.y ?? 0) + (dialogBox?.height ?? 0) - 8,
  );
  await captureScreenshot(page, testInfo, "preview-cc-html");
});

test("a reply quote dates the original in the browser's time zone and a forward keeps the HTML", async ({
  page,
}, testInfo) => {
  await openInbox(page, "preview-fwd");
  await page
    .getByRole("main")
    .getByRole("button", { name: /Team sync notes/ })
    .click();
  const sent = await page.getByRole("dialog").locator("time").getAttribute("datetime");
  const dateText = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  })
    .format(new Date(sent ?? ""))
    .replace(/ /g, " ");

  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const reply = page.getByRole("dialog", { name: "Reply" });
  await expect(reply.getByRole("textbox", { name: "Message" })).toContainText(
    `On ${dateText}, Lena Park`,
  );
  await captureScreenshot(page, testInfo, "preview-reply-attribution");
  await reply.getByRole("button", { name: "Discard" }).click();

  await page.getByRole("button", { name: "Forward", exact: true }).click();
  const forward = page.getByRole("dialog", { name: "Forward" });
  const body = forward.getByRole("textbox", { name: "Message" });
  await expect(body.locator("blockquote").first()).toContainText(`Date: ${dateText}`);
  await expect(body.locator("strong", { hasText: "Sync notes" })).toBeVisible();
  await expect(body.locator('a[href="https://example.invalid/plan"]')).toBeVisible();
  await expect(body.locator("li", { hasText: "Ship Friday" })).toBeVisible();
  await captureScreenshot(page, testInfo, "preview-forward-html");

  await forward.getByLabel("To").fill("lee@example.test,");
  await forward.getByRole("button", { name: "Send", exact: true }).click();
  await expect(forward).toBeHidden();
  await expect
    .poll(
      async () => {
        const { userId } = await rpc<{ userId: string }>(page, "me", {});
        const snapshot = (await (
          await page.request.get(`${api()}/__e2e/gmail?userId=${userId}`)
        ).json()) as Record<string, { sent: { raw: string }[] }>;
        return snapshot["e2e-first"]?.sent.at(-1)?.raw ?? "";
      },
      { timeout: 30_000 },
    )
    .toContain("Fwd: Team sync notes");
});

import { expect, type Page, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

const api = () => process.env.API_URL ?? "http://127.0.0.1:3110";

interface EmulatedMail {
  id: string;
  threadId: string;
  raw: string;
}
type Snapshot = Record<string, { address: string; drafts: EmulatedMail[]; sent: EmulatedMail[] }>;

const count = (snapshot: Snapshot, ref: string, kind: "drafts" | "sent") =>
  snapshot[ref]?.[kind].length ?? 0;

/**
 * What the Gmail emulator behind the API holds. No real mailbox is involved anywhere in this spec.
 * The emulator lives as long as the test run, so each test counts against what it found at the start.
 */
async function gmail(page: Page): Promise<Snapshot> {
  const response = await page.request.get(`${api()}/__e2e/gmail`);
  return (await response.json()) as Snapshot;
}

/** The value of one header of a raw message, and its decoded plain-text part. */
function headerOf(raw: string, name: string): string | undefined {
  const match = new RegExp(`^${name}:[ \\t]*(.*(?:\\r?\\n[ \\t].*)*)`, "im").exec(raw);
  return match?.[1]?.replace(/\r?\n[ \t]+/g, " ").trim();
}
function textOf(raw: string): string {
  const part = /Content-Type: text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)\r?\n--/i.exec(raw)?.[1] ?? "";
  return Buffer.from(part.replace(/\s+/g, ""), "base64").toString("utf8");
}

async function connectTwoGmailAccounts(page: Page) {
  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  const gmailRow = page
    .getByRole("dialog")
    .getByText("Gmail", { exact: true })
    .first()
    .locator("xpath=ancestor::*[.//button][1]");
  await gmailRow.getByRole("button", { name: "Add", exact: true }).click();
  await gmailRow.getByRole("button", { name: "Added", exact: true }).click();
  const detail = page.getByTestId("connection-detail");
  await detail.getByRole("button", { name: "Add another", exact: true }).click();
  await expect(detail.getByLabel("Account label")).toHaveCount(2);
  const renamed = page.waitForResponse(
    (response) => response.url().includes("connections/rename") && response.ok(),
  );
  await detail.getByLabel("Account label").nth(1).fill("Work");
  await detail.getByLabel("Account label").nth(1).blur();
  await renamed;
  await page.getByRole("button", { name: "Close integrations" }).click();
}

test("replying to a message saves a draft, sends it into the same thread, and shows it as sent", async ({
  page,
}, testInfo) => {
  await signup(page, `compose-${Date.now()}@rakazo.test`, "password12", "Compose User");
  await completeOnboarding(page);
  await connectTwoGmailAccounts(page);
  const before = await gmail(page);

  const main = page.getByRole("main");
  await main.getByRole("button", { name: /Offsite dates/ }).click();
  await page.getByRole("button", { name: "Reply", exact: true }).click();

  const composer = page.getByRole("dialog", { name: "Reply" });
  await expect(composer.getByLabel("To")).toHaveValue("Sam Rivera <sam@example.test>");
  await expect(composer.getByLabel("Subject")).toHaveValue("Re: Offsite dates");
  const body = composer.getByLabel("Message");
  await expect(body).toHaveValue(/> Can you do the 14th or the 21st\?/);
  // The cursor starts above the quoted original.
  await expect(body).toBeFocused();
  await captureScreenshot(page, testInfo, "compose-reply");

  // Typing autosaves a Gmail draft in the original thread.
  const saved = page.waitForResponse(
    (response) => response.url().includes("inbox/compose/draftSave") && response.ok(),
  );
  await body.pressSequentially("Thursday the 14th works for me.");
  await saved;
  await expect(composer.getByText("Draft saved", { exact: true })).toBeVisible();
  await expect
    .poll(async () => count(await gmail(page), "e2e-first", "drafts"))
    .toBe(count(before, "e2e-first", "drafts") + 1);
  const draft = (await gmail(page))["e2e-first"]?.drafts.at(-1);
  expect(draft?.threadId).toBe("e2e-t-offsite");
  expect(count(await gmail(page), "e2e-first", "sent")).toBe(count(before, "e2e-first", "sent"));

  // Dark and phone-sized renderings of the same composer.
  await page.emulateMedia({ colorScheme: "dark" });
  await captureScreenshot(page, testInfo, "compose-reply-dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, testInfo, "compose-reply-phone");
  await page.setViewportSize({ width: 1280, height: 720 });

  // Send is the confirmation: one click sends and the composer closes.
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(composer).toBeHidden();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();

  await expect
    .poll(async () => count(await gmail(page), "e2e-first", "sent"))
    .toBe(count(before, "e2e-first", "sent") + 1);
  const after = (await gmail(page))["e2e-first"];
  const sent = after?.sent.at(-1);
  expect(sent?.threadId).toBe("e2e-t-offsite");
  expect(headerOf(sent?.raw ?? "", "To")).toBe("Sam Rivera <sam@example.test>");
  expect(headerOf(sent?.raw ?? "", "Subject")).toBe("Re: Offsite dates");
  expect(headerOf(sent?.raw ?? "", "In-Reply-To")).toBe("<e2e-a-1@mail.example.test>");
  expect(headerOf(sent?.raw ?? "", "References")).toContain("<e2e-a-1@mail.example.test>");
  expect(textOf(sent?.raw ?? "")).toContain("Thursday the 14th works for me.");
  expect(textOf(sent?.raw ?? "")).toContain("> Can you do the 14th or the 21st?");
  // The draft became the sent message, and the other account was never touched.
  expect(count(await gmail(page), "e2e-first", "drafts")).toBe(
    count(before, "e2e-first", "drafts"),
  );
  expect(count(await gmail(page), "e2e-second", "sent")).toBe(count(before, "e2e-second", "sent"));
});

test("a new message sends from the chosen account with Ctrl or Cmd+Enter, and an empty one closes silently", async ({
  page,
}, testInfo) => {
  await signup(page, `compose-new-${Date.now()}@rakazo.test`, "password12", "Compose New");
  await completeOnboarding(page);
  await connectTwoGmailAccounts(page);
  const before = await gmail(page);

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("dialog", { name: "Compose" });
  await expect(composer.getByLabel("To")).toBeFocused();
  // Nothing typed: Escape closes without a prompt and leaves no draft behind.
  await page.keyboard.press("Escape");
  await expect(composer).toBeHidden();
  expect(count(await gmail(page), "e2e-first", "drafts")).toBe(
    count(before, "e2e-first", "drafts"),
  );

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  composer = page.getByRole("dialog", { name: "Compose" });
  await composer.getByLabel("From").selectOption({ label: "Work" });
  await composer.getByLabel("To").fill("Priya Shah <priya@example.test>");
  await composer.getByRole("button", { name: "Cc", exact: true }).click();
  await composer.getByLabel("Cc").fill("dev@example.test");
  await composer.getByRole("button", { name: "Bcc", exact: true }).click();
  await composer.getByLabel("Bcc").fill("audit@example.test");
  await composer.getByLabel("Subject").fill("Zürich plans — ünïcode");
  await composer.getByLabel("Message").fill("Line one\n\n<b>not bold</b>");
  await captureScreenshot(page, testInfo, "compose-new");
  await composer.getByLabel("Message").press("ControlOrMeta+Enter");
  await expect(composer).toBeHidden();

  await expect
    .poll(async () => count(await gmail(page), "e2e-second", "sent"))
    .toBe(count(before, "e2e-second", "sent") + 1);
  const sent = (await gmail(page))["e2e-second"]?.sent.at(-1);
  expect(headerOf(sent?.raw ?? "", "To")).toBe("Priya Shah <priya@example.test>");
  expect(headerOf(sent?.raw ?? "", "Cc")).toBe("dev@example.test");
  expect(headerOf(sent?.raw ?? "", "Bcc")).toBe("audit@example.test");
  expect(headerOf(sent?.raw ?? "", "In-Reply-To")).toBeUndefined();
  expect(headerOf(sent?.raw ?? "", "Subject")).toMatch(/^=\?UTF-8\?B\?/);
  expect(textOf(sent?.raw ?? "").replace(/\r\n/g, "\n")).toBe("Line one\n\n<b>not bold</b>");
  expect(count(await gmail(page), "e2e-first", "sent")).toBe(count(before, "e2e-first", "sent"));
});

test("closing a composer with text in it keeps the draft in Gmail", async ({ page }) => {
  await signup(page, `compose-keep-${Date.now()}@rakazo.test`, "password12", "Compose Keep");
  await completeOnboarding(page);
  await connectTwoGmailAccounts(page);
  const before = await gmail(page);

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "Compose" });
  await composer.getByLabel("To").fill("priya@example.test");
  await composer.getByLabel("Subject").fill("Half written");
  await page.keyboard.press("Escape");
  await expect(composer).toBeHidden();
  await expect
    .poll(async () => count(await gmail(page), "e2e-first", "drafts"))
    .toBe(count(before, "e2e-first", "drafts") + 1);
  expect(count(await gmail(page), "e2e-first", "sent")).toBe(count(before, "e2e-first", "sent"));
});

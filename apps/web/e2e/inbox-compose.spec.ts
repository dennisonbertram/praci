import { expect, type Page, test } from "@playwright/test";
import {
  captureScreenshot,
  completeOnboarding,
  connectTwoGmailAccounts,
  rpc,
  signup,
} from "./helpers";

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
 * Each user has their own accounts, so a test counts against what it found at the start.
 */
async function gmail(page: Page): Promise<Snapshot> {
  const { userId } = await rpc<{ userId: string }>(page, "me", {});
  const response = await page.request.get(`${api()}/__e2e/gmail?userId=${userId}`);
  return (await response.json()) as Snapshot;
}

/** The value of one header of a raw message, and its decoded plain-text part. */
function headerOf(raw: string, name: string): string | undefined {
  const match = new RegExp(`^${name}:[ \\t]*(.*(?:\\r?\\n[ \\t].*)*)`, "im").exec(raw);
  return match?.[1]?.replace(/\r?\n[ \t]+/g, " ").trim();
}
function partOf(raw: string, type: "plain" | "html"): string {
  const part =
    new RegExp(`Content-Type: text/${type}[\\s\\S]*?\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n--`, "i").exec(
      raw,
    )?.[1] ?? "";
  return Buffer.from(part.replace(/\s+/g, ""), "base64").toString("utf8");
}
const textOf = (raw: string) => partOf(raw, "plain");
const htmlOf = (raw: string) => partOf(raw, "html");

async function connectGmail(page: Page) {
  await page.getByTestId("sidebar-inbox").click();
  await page.getByRole("button", { name: "Connect mail", exact: true }).click();
  await connectTwoGmailAccounts(page);
  await page.getByTestId("sidebar-inbox").click();
}

test("replying to a message saves a draft, sends it into the same thread, and shows it as sent", async ({
  page,
}, testInfo) => {
  await signup(page, `compose-${Date.now()}@rakazo.test`, "password12", "Compose User");
  await completeOnboarding(page);
  await connectGmail(page);
  const before = await gmail(page);

  const main = page.getByRole("main");
  await main.getByRole("button", { name: /Offsite dates/ }).click();
  // Opening a reply and leaving it alone saves nothing to Gmail.
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Reply" })).toBeVisible();
  await page.waitForTimeout(3_000);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Reply" })).toBeHidden();
  expect(count(await gmail(page), "e2e-first", "drafts")).toBe(
    count(before, "e2e-first", "drafts"),
  );
  await page.getByRole("button", { name: "Reply", exact: true }).click();

  const composer = page.getByRole("dialog", { name: "Reply" });
  await expect(composer.getByRole("button", { name: "Remove sam@example.test" })).toBeVisible();
  await expect(composer.getByLabel("Subject")).toHaveValue("Re: Offsite dates");
  const body = composer.getByRole("textbox", { name: "Message" });
  // The cursor starts above the quoted original.
  await expect(body).toBeFocused();
  await expect(body.locator("p").first()).toHaveText("");
  // The quoted original starts collapsed; it is still sent.
  await expect(body.locator("blockquote")).toBeHidden();
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

  await composer.getByRole("button", { name: "Show original message" }).click();
  await expect(body.locator("blockquote")).toContainText("Can you do the 14th or the 21st?");

  // Dark and phone-sized renderings of the same composer.
  await page.emulateMedia({ colorScheme: "dark" });
  await captureScreenshot(page, testInfo, "compose-reply-dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, testInfo, "compose-reply-phone");
  await page.setViewportSize({ width: 1280, height: 720 });

  // Send is the confirmation: one click sends and the composer closes.
  // Undo brings the composer back with its text and sends nothing.
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(composer).toBeHidden();
  await expect(page.getByText("Sending…")).toBeVisible();
  await captureScreenshot(page, testInfo, "compose-undo-toast");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Reply" });
  await expect(reopened.getByRole("textbox", { name: "Message" })).toContainText(
    "Thursday the 14th works for me.",
  );
  await page.waitForTimeout(1_000);
  expect(count(await gmail(page), "e2e-first", "sent")).toBe(count(before, "e2e-first", "sent"));

  // Sending again delivers once and says so, above the preview.
  await reopened.getByRole("button", { name: "Send", exact: true }).click();
  await expect(reopened).toBeHidden();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible({ timeout: 30_000 });

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
  await connectGmail(page);
  const before = await gmail(page);

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("dialog", { name: "New message" });
  await expect(composer.getByLabel("To")).toBeFocused();
  // Nothing typed: Escape closes without a prompt and leaves no draft behind.
  await page.keyboard.press("Escape");
  await expect(composer).toBeHidden();
  expect(count(await gmail(page), "e2e-first", "drafts")).toBe(
    count(before, "e2e-first", "drafts"),
  );

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  composer = page.getByRole("dialog", { name: "New message" });
  await composer.getByLabel("From").selectOption({ label: "Work" });
  await composer.getByLabel("To").fill("Priya Shah <priya@example.test>,");
  // Bcc stays out of sight until asked for.
  await expect(composer.getByLabel("Bcc")).toHaveCount(0);
  await composer.getByRole("button", { name: "Cc", exact: true }).click();
  await composer.getByLabel("Cc").fill("dev@example.test,");
  await composer.getByRole("button", { name: "Bcc", exact: true }).click();
  await composer.getByLabel("Bcc").fill("audit@example.test,");
  await composer.getByLabel("Subject").fill("Zürich plans — ünïcode");
  const message = composer.getByRole("textbox", { name: "Message" });
  await message.click();
  await page.keyboard.type("Line one");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("<b>not bold</b>");
  await captureScreenshot(page, testInfo, "compose-new");
  await page.keyboard.press("ControlOrMeta+Enter");
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
  await connectGmail(page);
  const before = await gmail(page);

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "New message" });
  // An address still being typed when the composer closes is kept, not dropped.
  await composer.getByLabel("To").fill("priya@example.test");
  await composer.getByLabel("Subject").fill("Half written");
  await composer.getByLabel("To").focus();
  await page.keyboard.press("Escape");
  await expect(composer).toBeHidden();
  await expect
    .poll(async () => count(await gmail(page), "e2e-first", "drafts"))
    .toBe(count(before, "e2e-first", "drafts") + 1);
  expect(count(await gmail(page), "e2e-first", "sent")).toBe(count(before, "e2e-first", "sent"));
});

test("several recipients, rich text, a link and an attachment arrive as one multipart message", async ({
  page,
}, testInfo) => {
  await signup(page, `compose-rich-${Date.now()}@rakazo.test`, "password12", "Compose Rich");
  await completeOnboarding(page);
  await connectGmail(page);
  const before = await gmail(page);

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "New message" });
  const to = composer.getByLabel("To", { exact: true });
  await to.fill("a@example.test; b@example.test, nope,");
  await expect(composer.getByRole("button", { name: /^Remove / })).toHaveCount(3);
  await composer.getByLabel("Subject").fill("Plan");
  const message = composer.getByRole("textbox", { name: "Message" });
  await message.click();
  await page.keyboard.type("Hello ");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type("team");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type(" see https://example.test/plan ");
  await composer.getByRole("button", { name: "Bulleted list" }).click();
  await page.keyboard.type("first");
  await composer.locator("input[type=file]").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("attached text"),
  });
  await expect(composer.getByRole("list", { name: "Attachments" })).toContainText("notes.txt");
  await captureScreenshot(page, testInfo, "compose-rich");

  // The invalid address blocks Send until it is removed.
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(composer.getByRole("alert")).toContainText("nope isn't a valid email address");
  await composer.getByRole("button", { name: "Remove nope" }).click();
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(composer).toBeHidden();

  await expect
    .poll(async () => count(await gmail(page), "e2e-first", "sent"))
    .toBe(count(before, "e2e-first", "sent") + 1);
  const raw = (await gmail(page))["e2e-first"]?.sent.at(-1)?.raw ?? "";
  expect(headerOf(raw, "To")).toBe("a@example.test, b@example.test");
  expect(headerOf(raw, "Content-Type")).toMatch(/^multipart\/mixed/);
  expect(raw).toContain('filename="notes.txt"');
  expect(raw).toContain(Buffer.from("attached text").toString("base64"));
  expect(htmlOf(raw)).toContain("<strong>team</strong>");
  expect(htmlOf(raw)).toContain(
    '<a href="https://example.test/plan">https://example.test/plan</a>',
  );
  expect(htmlOf(raw)).toMatch(/<ul><li><p>.*first<\/p><\/li><\/ul>/);
  expect(textOf(raw)).toMatch(/^- .*first$/m);
});

test("forwarding keeps the original's attachments, and a removed one stays behind", async ({
  page,
}, testInfo) => {
  await signup(page, `compose-fwd-${Date.now()}@rakazo.test`, "password12", "Compose Forward");
  await completeOnboarding(page);
  await connectGmail(page);
  const before = await gmail(page);

  await page
    .getByRole("main")
    .getByRole("button", { name: /Q3 report/ })
    .click();
  await page.getByRole("button", { name: "Forward", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "Forward" });
  const files = composer.getByRole("list", { name: "Attachments" });
  await expect(files).toContainText("q3-report.pdf");
  await expect(files).toContainText("budget.csv");
  // To has focus; Tab moves the caret to the empty line above the quoted header.
  await expect(composer.getByLabel("To")).toBeFocused();
  const fwdBody = composer.getByRole("textbox", { name: "Message" });
  await expect(fwdBody).toHaveAttribute("contenteditable", "true");
  await composer.getByLabel("Subject").focus();
  await page.keyboard.press("Tab");
  await expect(fwdBody).toBeFocused();
  await page.keyboard.type("FYI");
  await expect(fwdBody.locator("p").first()).toHaveText("FYI");
  await expect(fwdBody.locator("blockquote")).not.toContainText("FYI");
  await captureScreenshot(page, testInfo, "compose-forward");
  await composer.getByRole("button", { name: "Remove budget.csv" }).click();
  await composer.getByLabel("To").fill("lee@example.test,");
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(composer).toBeHidden();

  await expect
    .poll(async () => count(await gmail(page), "e2e-first", "sent"), { timeout: 30_000 })
    .toBe(count(before, "e2e-first", "sent") + 1);
  const raw = (await gmail(page))["e2e-first"]?.sent.at(-1)?.raw ?? "";
  expect(headerOf(raw, "Subject")).toBe("Fwd: Q3 report");
  expect(raw).toContain('filename="q3-report.pdf"');
  expect(raw).toContain(Buffer.from("%PDF-1.4 Q3 report").toString("base64"));
  expect(raw).not.toContain("budget.csv");
});

test("many recipients fold into one line, Send stays in view, and Discard can be undone", async ({
  page,
}) => {
  await signup(page, `compose-many-${Date.now()}@rakazo.test`, "password12", "Compose Many");
  await completeOnboarding(page);
  await connectGmail(page);

  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "New message" });
  const crowd = Array.from({ length: 30 }, (_, i) => `person${i}.long@example.test`);
  await composer.getByLabel("To").fill(`${crowd.join(", ")},`);
  // The rows stay capped, so the body and the footer are still inside the dialog.
  const box = async (locator: ReturnType<typeof composer.locator>) =>
    (await locator.boundingBox()) as { y: number; height: number };
  const dialog = await box(composer);
  const send = await box(composer.getByRole("button", { name: "Send", exact: true }));
  expect(send.y + send.height).toBeLessThanOrEqual(dialog.y + dialog.height);
  await expect(composer.getByRole("textbox", { name: "Message" })).toBeInViewport({ ratio: 1 });

  await composer.getByLabel("Subject").fill("Crowd");
  await expect(composer.getByRole("button", { name: /\+28 more/ })).toBeVisible();
  await composer.getByRole("button", { name: /\+28 more/ }).focus();
  await expect(composer.getByLabel("To")).toBeFocused();

  await composer.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(composer).toBeHidden();
  await expect(page.getByText("Draft discarded")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New message" }).getByLabel("Subject")).toHaveValue(
    "Crowd",
  );
});

import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test.describe.configure({ mode: "serial" });

test("agent-attached files appear as downloadable cards", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `artifact-card-${stamp}@rakazo.test`, "password12", "Artifact Card");
  await completeOnboarding(page);

  const composer = page.getByPlaceholder(/Message/);
  await composer.fill("write notes/result.txt and attach it to the thread");
  await page.keyboard.press("Enter");

  // Scope to ArtifactFileCard text (name + mime); sidebar bot status can also
  // include the prompt path notes/result.txt once status syncs immediately.
  const fileCard = page.getByRole("button", { name: /result\.txt text\/plain/ });
  await expect(fileCard).toBeVisible({ timeout: 30_000 });
  await captureScreenshot(page, testInfo, "current-file-card");

  const downloadPromise = page.waitForEvent("download");
  await fileCard.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("result.txt");
});

test("agent-attached Markdown opens a rendered preview and can be downloaded", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await signup(page, `markdown-preview-${stamp}@rakazo.test`, "password12", "Markdown Preview");
  await completeOnboarding(page);

  const composer = page.getByPlaceholder(/Message/);
  await composer.fill(
    "write path notes/preview.md and attach it to the thread says # Project preview",
  );
  await page.keyboard.press("Enter");

  const previewButton = page.getByRole("button", { name: "Preview preview.md" });
  await expect(previewButton).toBeVisible({ timeout: 30_000 });
  await captureScreenshot(page, testInfo, "markdown-file-card");
  await previewButton.click();

  const dialog = page.getByRole("dialog", { name: "preview.md" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Project preview" })).toBeVisible();
  const closeButton = dialog.getByRole("button", { name: "Close preview" });
  const downloadButton = dialog.getByRole("button", { name: "Download preview.md" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(downloadButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
  await captureScreenshot(page, testInfo, "markdown-preview-open");

  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("preview.md");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(previewButton).toBeFocused();
});

test("agent-attached HTML renders in the sandboxed preview", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `html-preview-${stamp}@rakazo.test`, "password12", "HTML Preview");
  await completeOnboarding(page);

  const composer = page.getByPlaceholder(/Message/);
  await composer.fill(
    "write path notes/page.html and attach it to the thread says <h1>Rendered page</h1><p id=ran></p><script>document.getElementById('ran').textContent = 'script ran'</script>",
  );
  await page.keyboard.press("Enter");

  const previewButton = page.getByRole("button", { name: "Preview page.html" });
  await expect(previewButton).toBeVisible({ timeout: 30_000 });
  await previewButton.click();

  const dialog = page.getByRole("dialog", { name: "page.html" });
  await expect(dialog).toBeVisible();
  // The viewer loads the network shell, which renders the document in a nested sandboxed frame.
  const shell = dialog.locator('iframe[title="page.html"]');
  await expect(shell).toHaveAttribute("src", "/html-viewer.html");
  const preview = shell.contentFrame().locator("iframe#preview").contentFrame();
  await expect(preview.getByRole("heading", { name: "Rendered page" })).toBeVisible();
  await expect(preview.getByText("script ran")).toBeVisible();
  // The preview's opaque origin keeps it away from the app's storage and DOM.
  expect(await preview.locator("body").evaluate(() => window.origin)).toBe("null");
  await captureScreenshot(page, testInfo, "html-preview-open");
});

import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { completeOnboarding, createNamedBot, signup } from "./helpers";

async function dropFile(target: Locator, name: string) {
  const dataTransfer = await target.page().evaluateHandle((fileName) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["dropped"], fileName, { type: "text/plain" }));
    return transfer;
  }, name);
  await target.dispatchEvent("dragenter", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await target.dispatchEvent("drop", { dataTransfer });
}

test("dropping files on an agent attaches them and sends with Enter", async ({ page }) => {
  await signup(page, `drop-attach-${Date.now()}@rakazo.test`, "password12", "Drop Test");
  await completeOnboarding(page);
  const alphaId = await createNamedBot(page, "Alpha Drop");
  const betaId = await createNamedBot(page, "Beta Drop");
  const overlay = page.getByTestId("data-room-drop-overlay");

  // (a) Transcript of the open chat.
  await page.goto(`/app/${alphaId}`);
  await expect(page.getByPlaceholder("Message Alpha Drop")).toBeEnabled();
  await expect(page.getByTestId("transcript").getByText("blank slate")).toBeVisible();
  await dropFile(page.getByTestId("transcript"), "transcript.txt");
  await expect(page.getByRole("button", { name: "Remove transcript.txt" })).toBeVisible();
  await expect(overlay).toHaveCount(0);

  // (b) A different agent's sidebar row opens that chat with the chip and focuses the composer.
  await dropFile(page.locator(`[data-roster-bot-id="${betaId}"]`), "sidebar.txt");
  await expect(page).toHaveURL(new RegExp(`/app/${betaId}$`));
  await expect(page.getByRole("button", { name: "Remove sidebar.txt" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Message/ })).toBeFocused();
  await expect(overlay).toHaveCount(0);

  // (c) Enter sends an attachment-only message; the transcript shows it.
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("transcript").getByText("sidebar.txt").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove sidebar.txt" })).toBeHidden();

  // (d) No drop above raised the Data room overlay or uploaded to it.
  await expect(overlay).toHaveCount(0);
  await expect(page.getByTestId("data-room-toasts")).toHaveCount(0);
});

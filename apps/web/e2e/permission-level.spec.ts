import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openUserSettings, rpc, signup } from "./helpers";

type PermissionSettings = { level: string | null; effectiveDefault: string };

const LEVEL_LABELS: Record<string, string> = {
  open: "Open",
  ask_changes: "Ask for changes",
  ask_everything: "Ask for everything",
};

const ALWAYS_ASK_NOTE =
  "Sending to new people, payments, permanent deletes and access requests always ask.";

/** Opens the Privacy and approvals section and returns the enabled Permissions select. */
async function openPermissionSelect(page: Page) {
  const settings = await openUserSettings(page, "privacy");
  await expect(settings).toHaveAttribute("data-settings-section", "privacy");
  const approvals = settings.getByTestId("action-confirmation-settings");
  await expect(approvals.getByRole("heading", { name: "Approvals", exact: true })).toBeVisible();
  const select = approvals.getByTestId("permission-level").getByRole("combobox");
  // The select stays disabled until permissions.get returns; enabled means the row loaded.
  await expect(select).toBeEnabled();
  return select;
}

test("permission level sets explicitly, restores the default, and persists on reload", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await signup(page, `permissions-${stamp}@rakazo.test`, "password12", `Permissions ${stamp}`);
  await completeOnboarding(page);

  // The deployment default is an env choice; the Default option names whatever it resolves to.
  const { effectiveDefault } = await rpc<PermissionSettings>(page, "permissions/get", {});
  const defaultLabel = `Default (${LEVEL_LABELS[effectiveDefault] ?? effectiveDefault})`;
  const defaultIsOpen = effectiveDefault === "open";

  const select = await openPermissionSelect(page);
  const approvals = page.getByTestId("action-confirmation-settings");
  const customize = approvals.locator("summary").filter({ hasText: "Customize actions" });
  await expect(customize).toBeVisible();
  await expect(customize.locator("xpath=ancestor::details")).not.toHaveAttribute("open");
  await expect(select.locator("xpath=ancestor::details")).toHaveCount(0);
  // A fresh space follows the deployment default, offered first as Default (…).
  await expect(select).toHaveValue("");
  await expect(select.locator("option").first()).toHaveText(defaultLabel);
  await expect(page.getByText(ALWAYS_ASK_NOTE, { exact: true })).toHaveCount(defaultIsOpen ? 1 : 0);
  await captureScreenshot(page, testInfo, "settings-permissions-customize-closed");

  await customize.click();
  const actions = approvals.getByTestId("approval-actions-table");
  await expect(actions).toBeVisible();
  await expect(approvals.getByText("More actions", { exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "settings-permissions-customize-open");
  await customize.click();

  await select.selectOption("ask_everything");
  await expect(select).toHaveValue("ask_everything");
  await expect(page.getByText(ALWAYS_ASK_NOTE, { exact: true })).toHaveCount(0);
  await expect
    .poll(() => rpc<PermissionSettings>(page, "permissions/get", {}).then((saved) => saved.level))
    .toBe("ask_everything");
  await captureScreenshot(page, testInfo, "settings-permissions-explicit");

  await page.reload();
  const persisted = await openPermissionSelect(page);
  await expect(persisted).toHaveValue("ask_everything");
  await captureScreenshot(page, testInfo, "settings-permissions-reload");

  // Restoring Default saves null, so the row again names the effective level it follows.
  await persisted.selectOption("");
  await expect(persisted).toHaveValue("");
  await expect(persisted.locator("option").first()).toHaveText(defaultLabel);
  await expect(page.getByText(ALWAYS_ASK_NOTE, { exact: true })).toHaveCount(defaultIsOpen ? 1 : 0);
  await expect
    .poll(() => rpc<PermissionSettings>(page, "permissions/get", {}).then((saved) => saved.level))
    .toBeNull();
  await captureScreenshot(page, testInfo, "settings-permissions-restored-default");

  await page.reload();
  const restored = await openPermissionSelect(page);
  await expect(restored).toHaveValue("");
});

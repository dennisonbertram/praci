import { expect, type Page, type TestInfo } from "@playwright/test";

export function isRealSandboxProvider(provider = process.env.SANDBOX_PROVIDER) {
  return provider === "e2b" || provider === "daytona" || provider === "box";
}

export function realSandboxTimeout(real: number, emulated: number) {
  if (process.env.SANDBOX_PROVIDER === "box") return Math.max(real, 300_000);
  return isRealSandboxProvider() ? real : emulated;
}

export function activeBotId(page: Page) {
  const id = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  if (!id || id === "app") throw new Error(`missing bot id in ${page.url()}`);
  return id;
}

export async function rpc<T>(page: Page, procedure: string, body: unknown): Promise<T> {
  const response = await page.request.post(`/rpc/${procedure}`, { data: { json: body } });
  const parsed = (await response.json()) as { json?: T; error?: { message?: string } };
  if (!response.ok() || parsed.error) {
    throw new Error(`${procedure} ${response.status()}: ${parsed.error?.message ?? "failed"}`);
  }
  return parsed.json as T;
}

export async function completeOnboarding(page: Page, testInfo?: TestInfo) {
  await page.waitForURL(/\/(onboarding|app)/, { timeout: 20_000 });
  // Optional Server integrations step (needsSetup). Skip when shown, then the
  // first bot is created automatically — land in Chief's chat with no form.
  const integrations = page.getByRole("heading", { name: "Server integrations", exact: true });
  const chief = page.getByText("Chief").first();
  await integrations.or(chief).or(page.getByText("Opening chat…")).waitFor({ timeout: 20_000 });
  if ((await chief.isVisible().catch(() => false)) && page.url().includes("/app")) {
    if (testInfo) {
      await captureScreenshot(page, testInfo, "03-create-first-bot");
      await captureScreenshot(page, testInfo, "06-onboarding-complete");
    }
    return;
  }
  if (await integrations.isVisible().catch(() => false)) {
    if (testInfo) await captureScreenshot(page, testInfo, "02-connect-apps");
    await page.getByRole("button", { name: "Skip", exact: true }).click();
  }
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
  await expect(page.getByText("Chief").first()).toBeVisible();
  if (testInfo) {
    await captureScreenshot(page, testInfo, "03-create-first-bot");
    await captureScreenshot(page, testInfo, "06-onboarding-complete");
  }
}

export async function signup(
  page: Page,
  email: string,
  password: string,
  name: string,
  testInfo?: TestInfo,
) {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create your Rakazo" })).toBeVisible();
  if (testInfo) await captureScreenshot(page, testInfo, "01-sign-up");
  await page.getByPlaceholder("Your name").fill(name);
  await page.getByPlaceholder("Your email address").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function captureScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    path: screenshotPath,
  });
  await testInfo.attach(name, { contentType: "image/png", path: screenshotPath });
}

/** Click "Create new Bot" in the + picker; the app creates the bot and opens its chat. */
export async function openNewBot(page: Page) {
  await page.getByTestId("create-menu-trigger").click();
  await page.getByTestId("create-new-bot").click();
}

export async function openNewGroup(page: Page) {
  await page.getByTestId("create-menu-trigger").click();
  await page.getByTestId("create-new-group").click();
}

export async function openNewSpace(page: Page) {
  await page.getByTestId("create-menu-trigger").click();
  await page.getByTestId("create-new-space").click();
}

/** Create a bot from the + picker and wait for its chat. Profile options are applied afterwards over RPC. */
export async function createBotFromPicker(
  page: Page,
  options: { name?: string; computerMode?: "team" | "dedicated" } = {},
) {
  await openNewBot(page);
  const name = options.name ?? "New Bot";
  // The new bot's chat is up only once its composer shows; the URL already matches /app/<id> before that.
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  const botId = page.url().split("/").pop()!;
  if (options.name) await rpc(page, "bots/update", { botId, name });
  if (options.computerMode)
    await rpc(page, "bots/setComputer", { botId, mode: options.computerMode });
  if (options.name || options.computerMode) await page.reload();
  await expect(page.getByPlaceholder(`Message ${name}`)).toBeVisible();
}

/** Open the user Settings overlay, optionally switching to a sidebar section. */
export async function openUserSettings(
  page: Page,
  section?:
    | "general"
    | "models"
    | "memory"
    | "voice"
    | "usage"
    | "computer"
    | "billing"
    | "updates",
) {
  await page.getByTestId("user-menu-trigger").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByTestId("user-settings");
  await expect(settings).toBeVisible();
  if (section && section !== "general") {
    await settings.getByTestId(`settings-nav-${section}`).click();
  }
  return settings;
}

/** Create a named bot via RPC for test setup (skips the + picker). */
export async function createNamedBot(
  page: Page,
  name: string,
  options: { computerMode?: "team" | "dedicated" } = {},
) {
  const bot = await rpc<{ id: string; name: string }>(page, "bots/create", {
    name,
    title: "",
    description: "",
    notifyOnFinish: true,
    computerMode: options.computerMode ?? "team",
  });
  await page.goto(`/app/${bot.id}`);
  await expect(page.getByPlaceholder(`Message ${name}`)).toBeVisible();
  return bot.id;
}

/** Opens the Integrations page from the sidebar. */
export async function openIntegrations(page: Page) {
  await page.getByTestId("sidebar-integrations").click();
  await expect(page).toHaveURL(/\/app\/integrations$/);
  await expect(page.getByRole("heading", { name: "Integrations", level: 1 })).toBeVisible();
}

/** Runs the connect dialog for a managed app through sign-in, agent choice and the done step. */
export async function finishConnectDialog(page: Page, appName: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByText(`${appName} connected`, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/**
 * From the Integrations page, connects two Gmail accounts through the connect dialog and the
 * app's detail page, and names the second one. Leaves the browser on Gmail's detail page.
 */
export async function connectTwoGmailAccounts(page: Page, secondName = "Work") {
  await page.getByRole("button", { name: "Connect Gmail", exact: true }).click();
  await finishConnectDialog(page, "Gmail");
  await page.getByRole("link", { name: "Gmail", exact: true }).click();
  await page.getByRole("button", { name: "Add another account", exact: true }).click();
  await finishConnectDialog(page, "Gmail");
  const accounts = page.getByRole("button", { name: "Rename", exact: true });
  await expect(accounts).toHaveCount(2);
  await accounts.nth(1).click();
  const renamed = page.waitForResponse(
    (response) => response.url().includes("connections/rename") && response.ok(),
  );
  await page.getByLabel("Account name").fill(secondName);
  await page.getByLabel("Account name").press("Enter");
  await renamed;
  await expect(page.getByText(secondName, { exact: true })).toBeVisible();
}

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  activeBotId,
  captureScreenshot,
  completeOnboarding,
  connectTwoGmailAccounts,
  openIntegrations,
  realSandboxTimeout,
  rpc,
  signup,
} from "./helpers";

function sidebarBotButton(page: Page, name: RegExp | string) {
  return page.locator("[data-sidebar-group] [data-roster-bot-id]").filter({
    has: page.locator("[data-roster-bot-name]").filter({ hasText: name }),
  });
}

test.describe.configure({ mode: "serial" });

test("two users are isolated and a bot completes durable work", async ({ browser }, testInfo) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();

  const stamp = Date.now();
  await signup(pageA, `ada-${stamp}@rakazo.test`, "password12", "Ada", testInfo);
  await completeOnboarding(pageA, testInfo);
  await expect(pageA.getByText("Chief").first()).toBeVisible();

  await signup(pageB, `bob-${stamp}@rakazo.test`, "password12", "Bob");
  await completeOnboarding(pageB);
  await expect(pageB.getByText("Chief").first()).toBeVisible();
  await expect(pageB.getByText("Ada", { exact: true })).toHaveCount(0);

  const composer = pageA.getByPlaceholder(/Message/);
  await composer.fill("write a file in your home called notes/result.txt that says isolation-ok");
  await pageA.keyboard.press("Enter");
  await expect(
    pageA.getByText(/writing that into my home|isolation-ok|handled/i).first(),
  ).toBeVisible({
    timeout: 30_000,
  });

  await pageA.reload();
  await expect(pageA.getByText(/isolation-ok|writing that into my home/i).first()).toBeVisible();
  await captureScreenshot(pageA, testInfo, "07-durable-bot-work");

  await a.close();
  await b.close();
});

test("takeover, routine, plugins, and export are reachable", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `flow-${stamp}@rakazo.test`, "password12", "Flow");
  await completeOnboarding(page);

  const composer = page.getByPlaceholder(/Message/);
  await composer.fill("install the gsc cli and sign in");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/handing you the computer|sign in to continue|protected input/i).first(),
  ).toBeVisible({ timeout: realSandboxTimeout(90_000, 30_000) });
  await expect
    .poll(() => threadRunStatus(page), {
      timeout: realSandboxTimeout(90_000, 30_000),
      message: "the protected-input run must be ready for takeover",
    })
    .toBe("waiting_takeover");
  const computerCard = page.getByTestId("computer-card");
  await expect(computerCard).toBeVisible();
  await expect(computerCard.getByText("Needs takeover", { exact: true })).toBeVisible();
  await expect(computerCard.getByTestId("computer-card-open")).toBeVisible();
  await captureScreenshot(page, testInfo, "08-protected-input-request");
  await computerCard.getByTestId("computer-card-open").click();
  await page
    .getByTestId("computer-chrome")
    .getByRole("button", { name: "Take control", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Close computer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip", exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "I’m done", exact: true }).last()).toBeVisible();
  if (process.env.SANDBOX_PROVIDER === "box") await waitForBoxFramebuffer(page);
  await captureScreenshot(page, testInfo, "09-computer-takeover-outcomes");
  await page.getByRole("button", { name: "I’m done", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Close computer" })).toBeVisible();
  await page.getByRole("button", { name: "Close computer" }).click();
  await expect(page.getByText(/signed in|session stays/i).first()).toBeVisible({
    timeout: realSandboxTimeout(90_000, 30_000),
  });

  await composer.fill("sign in again so I can skip this time");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => threadRunStatus(page), {
      timeout: realSandboxTimeout(90_000, 30_000),
      message: "the second protected-input run must be ready for takeover",
    })
    .toBe("waiting_takeover");
  // Agent computer toggles the panel. Re-open when closed so Open can refresh computer status.
  const sidePanel = page.getByTestId("side-panel");
  if ((await sidePanel.getAttribute("data-panel")) === "computer") {
    await page.getByTitle(/^(Computer and )?routines$/i).click();
  }
  await page.getByTitle(/^(Computer and )?routines$/i).click();
  await expect(sidePanel).toHaveAttribute("data-panel", "computer");
  await expect(sidePanel).toHaveCSS("width", "384px");
  const [mainBox, panelBox] = await Promise.all([
    page.locator("main").boundingBox(),
    sidePanel.boundingBox(),
  ]);
  expect(mainBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect((mainBox?.x ?? 0) + (mainBox?.width ?? 0)).toBeLessThanOrEqual(panelBox?.x ?? 0);
  await sidePanel.getByTestId("computer-preview").hover();
  const openComputer = sidePanel.getByTestId("computer-preview-open");
  await expect(openComputer).toBeVisible({ timeout: 30_000 });
  await openComputer.click();
  await page
    .getByTestId("computer-chrome")
    .getByRole("button", { name: "Take control", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Close computer" })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Close computer" })).toBeVisible();
  await page.getByRole("button", { name: "Close computer" }).click();
  await expect(page.getByText(/login was skipped/i).last()).toBeVisible({
    timeout: realSandboxTimeout(90_000, 30_000),
  });
  await captureScreenshot(page, testInfo, "09a-computer-takeover-skipped");

  await page.getByRole("button", { name: "Create a routine" }).click();
  await page.locator("label:has-text('Name') input").fill("Monday briefing");
  await page
    .locator("label:has-text('Instruction') textarea")
    .fill("write a file in your home called notes/result.txt that says routine-ok");
  await page.getByRole("button", { name: "Choose when it runs" }).click();
  await page.getByRole("menuitem", { name: "On a schedule" }).hover();
  await page.getByRole("menuitem", { name: "Every day", exact: true }).click();
  const savedRoutine = page.waitForResponse(
    (response) => response.url().includes("/rpc/routines/create") && response.ok(),
  );
  await page.getByRole("button", { name: "Save" }).click();
  await savedRoutine;
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Monday briefing")).toBeVisible();
  await captureScreenshot(page, testInfo, "10-routine-created");

  await openIntegrations(page);
  await expect(page.getByPlaceholder("Search integrations")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Slack", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "11-plugins-catalog");

  await connectTwoGmailAccounts(page);
  await expect(page.getByTestId("tools-read")).toBeVisible();
  await captureScreenshot(page, testInfo, "11a2-multi-account-plugins");

  // Removing one account keeps the other; disconnecting the app removes the rest.
  await page.getByRole("button", { name: "Remove Work", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Disconnect Gmail", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Disconnect Gmail", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/integrations$/);
  await expect(page.getByRole("button", { name: "Connect Gmail", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "11b-connected-plugins-empty");

  // An app that opens a sign-in window: closing it reports a cancelled sign-in, and the
  // connection still finishes once the provider completes it.
  const connectPopup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect Linear", exact: true }).click();
  const popup = await connectPopup;
  await popup.close();
  await page.getByRole("dialog").getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("link", { name: "Linear", exact: true }).click();
  await page.getByRole("button", { name: "Disconnect Linear", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Disconnect Linear", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Connect Linear", exact: true })).toBeVisible();

  // Other connection types live under the custom connection dialog's Advanced section.
  const customDialog = page.getByRole("dialog");
  const openAdvanced = async () => {
    await page.getByRole("button", { name: "Add custom connection", exact: true }).click();
    await customDialog.getByText("Advanced", { exact: true }).click();
  };
  await openAdvanced();
  for (const label of ["OpenAPI", "GraphQL", "Executor", "Local command"]) {
    await expect(customDialog.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await captureScreenshot(page, testInfo, "11-custom-advanced");

  // Catalog Search is optional chrome; it must drop stale results when the query changes.
  await customDialog.getByRole("button", { name: "Search by domain", exact: true }).click();
  const search = customDialog.getByRole("textbox", { name: "Search" });
  await search.fill("github.com");
  await customDialog.getByRole("button", { name: "Search", exact: true }).click();
  await expect(customDialog.getByText("GitHub", { exact: true })).toBeVisible();
  await expect(customDialog.getByRole("button", { name: "MCP", exact: true })).toBeVisible();
  await expect(customDialog.getByRole("button", { name: "OPENAPI", exact: true })).toBeVisible();
  await expect(customDialog.getByRole("button", { name: "GRAPHQL", exact: true })).toBeDisabled();
  await expect(customDialog.getByRole("button", { name: "CLI", exact: true })).toBeDisabled();
  await captureScreenshot(page, testInfo, "11c-catalog-feed");
  await customDialog.getByRole("button", { name: "MCP", exact: true }).click();
  await expect(customDialog.getByRole("textbox", { name: "Server URL" })).toHaveValue(
    "https://mcp.example.test/mcp",
  );
  await customDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  const installSource = async (kind: string, fill: () => Promise<void>) => {
    await openAdvanced();
    await customDialog.getByRole("button", { name: kind, exact: true }).click();
    await fill();
    await customDialog.getByRole("button", { name: "Verify and add", exact: true }).click();
    await customDialog.getByRole("button", { name: "Done", exact: true }).click();
  };
  // Treg connects from its own tile, with a token.
  await page.getByRole("button", { name: "Connect Treg", exact: true }).click();
  await customDialog.getByPlaceholder("Token").fill("fake-treg-browser-credential");
  await customDialog.getByRole("button", { name: "Verify and add", exact: true }).click();
  await customDialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText(/MCP · treg\.to/)).toBeVisible();
  await installSource("OpenAPI", async () => {
    await customDialog.getByPlaceholder("Display name").fill("Browser API");
    await customDialog
      .getByPlaceholder("https://example.com/openapi.json")
      .fill("https://api.example.test/openapi.json");
    await customDialog.locator("select").selectOption("bearer");
    await customDialog.getByPlaceholder("Token").fill("fake-openapi-browser-credential");
  });
  await expect(page.getByText(/API · api\.example\.test/)).toBeVisible();
  await installSource("Executor", async () => {
    await customDialog
      .getByPlaceholder("https://executor.example/mcp")
      .fill("https://executor.example.test/mcp");
    await customDialog.getByPlaceholder("Token").fill("fake-executor-browser-credential");
  });
  await expect(page.getByText(/MCP · executor\.example\.test/)).toBeVisible();
  await captureScreenshot(page, testInfo, "11d-provider-emulators");

  await page.getByText("Chief").first().click();
  const gear = page.getByRole("button", { name: "Show settings" });
  if (!(await gear.isVisible().catch(() => false))) {
    await page.getByTitle(/^(Computer and )?routines$/i).click();
  }
  await gear.click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/chief-export\.json/i);
  const settings = page.getByTestId("bot-settings");
  await expect(settings.getByRole("button", { name: "Archive bot" })).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "Delete bot" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close panel" }).click();

  await page.locator("aside").first().getByRole("button", { name: /Chief/ }).first().click({
    button: "right",
  });
  const botMenu = page.getByRole("menu", { name: "Actions for Chief" });
  await expect(botMenu.getByRole("menuitem", { name: "Archive" })).toBeVisible();
  await botMenu.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("radio", { name: /Keep memories/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Delete memories too/ })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await captureScreenshot(page, testInfo, "12-bot-settings");
});

test("sign-in, spawn, and stop work in the shell", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
    );
  });
  const stamp = Date.now();
  const email = `shell-${stamp}@rakazo.test`;
  await signup(page, email, "password12", "Shell");
  await completeOnboarding(page);
  await page.evaluate(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });

  const composer = page.locator('textarea[name="chat-message"]');
  await composer.fill("spawn a bot named Scout to research venues");
  await page.keyboard.press("Enter");
  await expect(sidebarBotButton(page, /Scout/)).toBeVisible({
    timeout: 30_000,
  });
  await captureScreenshot(page, testInfo, "13-spawned-bot");

  await page
    .locator("[data-sidebar-group]")
    .getByRole("button", { name: /^Chief/ })
    .click();
  await composer.fill("keep working until I stop you");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("composer-steering-status")).toHaveCount(0);
  await expect(page.getByText("Messages sent now guide the next turn.")).toHaveCount(0);
  await expect(page.getByText(/^Steer /)).toHaveCount(0);
  await expect(composer).toHaveAttribute("placeholder", "Message Chief");
  // While a run goes on, Send shows only once there is something to send.
  await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  const voiceButton = page
    .getByTestId("composer-bar")
    .getByRole("button", { name: "Call Elio", exact: true });
  await expect(voiceButton).toBeVisible();
  await composer.fill("Use the newer report and keep the answer short.");
  await expect(voiceButton).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
  await composer.press("Tab");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByTestId("transcript").getByText("Use the newer report and keep the answer short."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "14-active-bot-work");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await expect(composer).toHaveAttribute("placeholder", "Message Chief");
  await captureScreenshot(page, testInfo, "14-active-bot-work-mobile");
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(browserErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  let releaseStopRequest: () => void = () => undefined;
  let markStopRequestStarted: () => void = () => undefined;
  const stopRequestStarted = new Promise<void>((resolve) => {
    markStopRequestStarted = resolve;
  });
  await page.route("**/rpc/threads/stop", async (route) => {
    markStopRequestStarted();
    await new Promise<void>((release) => {
      releaseStopRequest = release;
    });
    await route.continue();
  });
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await stopRequestStarted;
  // The draft is empty, so Send stays out of the bar while the run is stopping.
  await expect(page.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeDisabled();
  releaseStopRequest();
  // Idle Send stays disabled with an empty draft; wait for Stop to leave instead.
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password12");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });
  await expect(sidebarBotButton(page, /^Chief/)).toBeVisible();
  await expect(sidebarBotButton(page, /Scout/)).toBeVisible();
  await captureScreenshot(page, testInfo, "15-restored-session");
});

test("bot context menu pins, duplicates, edits, and confirms deletion", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await signup(page, `menu-${stamp}@rakazo.test`, "password12", "Menu");
  await completeOnboarding(page);

  const chief = page.getByRole("button", { name: /Chief/ }).first();
  await chief.click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Actions for Chief" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await captureScreenshot(page, testInfo, "16-bot-context-menu");
  await page.getByRole("menuitem", { name: "Mark as unread" }).click();

  // Chief is the open bot, so the auto-read on window focus must not undo the manual mark.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await chief.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Mark as read" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Mark as read" }).click();

  await chief.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Pin", exact: true }).click();

  await chief.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Unpin", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page.getByText("Chief copy").first()).toBeVisible();
  await captureScreenshot(page, testInfo, "17-pinned-and-duplicated-bot");

  const copy = page.getByRole("button", { name: /Chief copy/ }).first();
  await copy.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete Chief copy?" })).toBeVisible();
  await captureScreenshot(page, testInfo, "18-delete-confirmation");
  await page.getByRole("button", { name: "Cancel" }).click();

  await chief.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.locator("label:has-text('Name') input")).toHaveValue("Chief");
  await captureScreenshot(page, testInfo, "19-edit-profile");
});

async function threadRunStatus(page: Page) {
  const result = await rpc<{ run?: { status?: string } | null }>(page, "threads/get", {
    botId: activeBotId(page),
  });
  return result.run?.status ?? "idle";
}

async function waitForBoxFramebuffer(page: Page) {
  await expect
    .poll(
      async () => {
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          const canvas = frame.locator("canvas").first();
          if ((await canvas.count()) === 0) continue;
          const ready = await canvas
            .evaluate((element) => {
              const framebuffer = element as HTMLCanvasElement;
              return framebuffer.width > 0 && framebuffer.height > 0;
            })
            .catch(() => false);
          if (ready) return true;
        }
        return false;
      },
      { timeout: 60_000, message: "the Box noVNC framebuffer must be ready" },
    )
    .toBe(true);
}

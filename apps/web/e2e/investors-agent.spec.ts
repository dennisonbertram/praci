import { expect, test } from "@playwright/test";
import type { Bot } from "@rakazo/contracts";
import { captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("Ask on Investors opens the Investors agent with no Carta server", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signup(page, `investors-agent-${Date.now()}@rakazo.test`, "password12", "Investors Agent");
  await completeOnboarding(page);

  await page.getByTestId("sidebar-investors").click();
  const main = page.getByRole("main");
  // The empty view: no Carta connected, and Ask is still there.
  await expect(main.getByRole("button", { name: "Connect Carta" })).toBeVisible();
  await expect(page.getByTestId("investors-agent-panel")).toBeHidden();
  await main.getByRole("button", { name: "Ask Investors agent" }).click();

  const panel = page.getByTestId("investors-agent-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByPlaceholder("Message Investors agent")).toBeVisible();
  await captureScreenshot(page, testInfo, "investors-agent");

  // Opening the page again does not make a second agent.
  await page.reload();
  const agents = (await rpc<Bot[]>(page, "bots/list", undefined)).filter((bot) =>
    bot.spawnKey?.startsWith("investors-agent:"),
  );
  expect(agents).toHaveLength(1);
  expect(agents[0].name).toBe("Investors agent");
});

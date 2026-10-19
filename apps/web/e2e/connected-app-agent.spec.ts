import { expect, test } from "@playwright/test";
import type { Connection } from "@rakazo/contracts";
import {
  captureScreenshot,
  completeOnboarding,
  finishConnectDialog,
  openIntegrations,
  rpc,
  signup,
} from "./helpers";

test("connected app creates its agent and persists write and sharing controls", async ({
  page,
}, testInfo) => {
  await signup(page, `app-agent-${Date.now()}@rakazo.test`, "password12", "App Agent Test");
  await completeOnboarding(page);
  await openIntegrations(page);
  await page.getByRole("button", { name: "Connect Notion", exact: true }).click();
  await finishConnectDialog(page, "Notion");
  const connections = await rpc<Connection[]>(page, "connections/list", undefined);
  const connection = connections.find((row) => row.provider.toLowerCase() === "notion");
  expect(connection?.status).toBe("connected");
  const appPath = `/app/integrations/app/${connection!.connectorId}/${connection!.provider}`;
  await page.goto(appPath);
  await expect(page.getByRole("switch", { name: /Allow changes/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Create agent/ }).click();

  await expect(page.getByPlaceholder("Message Notion agent")).toBeVisible();
  const updated = (await rpc<Connection[]>(page, "connections/list", undefined)).find(
    (row) => row.id === connection!.id,
  )!;
  expect(updated.agentBotId).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`/app/${updated.agentBotId}$`));
  await expect(
    page.locator("[data-roster-bot-name]").filter({ hasText: "Notion agent" }),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "connected-app-agent-chat");

  await page.goto(appPath);
  const section = page.getByRole("region", { name: "Agent", exact: true });
  const writes = section.getByRole("switch", { name: "Allow changes in Notion" });
  const share = section.getByRole("switch", { name: "Share with all agents" });
  await expect(writes).not.toBeChecked();
  await expect(share).toBeChecked();
  await writes.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await captureScreenshot(page, testInfo, "connected-app-agent-confirm");
  await confirmation.getByRole("button", { name: "Allow changes", exact: true }).click();
  await expect(writes).toBeChecked();
  await share.click();
  await expect(share).not.toBeChecked();
  await page.reload();
  await expect(writes).toBeChecked();
  await expect(share).not.toBeChecked();
  await captureScreenshot(page, testInfo, "connected-app-agent-controls");
  await writes.click();
  await expect(writes).not.toBeChecked();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

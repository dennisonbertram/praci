import { expect, test } from "@playwright/test";
import { activeBotId, captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

type Pins = {
  revision: number;
  list: { title: string; items: { id: string; text: string; done: boolean }[] } | null;
} | null;

test("a bot's list renders beside the chat and saves ticks and new items", async ({
  page,
}, testInfo) => {
  await signup(page, `bot-pins-${Date.now()}@rakazo.test`, "password12", "Bot Pins");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder("Message Chief")).toBeVisible();
  const botId = activeBotId(page);

  // No pins yet: no strip, no list.
  await expect(page.getByRole("button", { name: "Agent computer" })).toBeVisible();
  await expect(page.getByTestId("pins-strip")).toHaveCount(0);
  await expect(page.getByTestId("pins-list")).toHaveCount(0);

  const saved = await rpc<{ ok: boolean }>(page, "pins/save", {
    botId,
    list: {
      title: "Launch",
      items: [
        { id: "item-one", text: "Write the announcement", done: false },
        { id: "item-two", text: "Book the venue", done: false },
      ],
    },
    baseRevision: 0,
  });
  expect(saved.ok).toBe(true);
  await page.reload();

  const list = page.getByTestId("pins-list");
  await expect(list.getByRole("heading", { name: "Launch" })).toBeVisible();
  await expect(list.getByText("Book the venue")).toBeVisible();
  await captureScreenshot(page, testInfo, "bot-pins");

  await list.getByRole("checkbox", { name: "Write the announcement" }).click();
  await expect
    .poll(async () => {
      const pins = await rpc<Pins>(page, "pins/get", { botId });
      return pins?.list?.items.find((item) => item.id === "item-one")?.done;
    })
    .toBe(true);

  await list.getByPlaceholder("Add item").fill("Send invites");
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => {
      const pins = await rpc<Pins>(page, "pins/get", { botId });
      return pins?.list?.items.map((item) => item.text);
    })
    .toEqual(["Write the announcement", "Book the venue", "Send invites"]);
  await expect(list.getByText("Send invites")).toBeVisible();
});

import { afterEach, expect, it } from "vitest";
import { browserNotificationMessage } from "./browser-notifications";
import { setHideAmounts } from "./hide-amounts-preference";

afterEach(() => setHideAmounts(false));

it("masks a currency amount in a notification body while amounts are hidden", () => {
  const event = {
    type: "thread.message.created",
    payload: { blocks: [{ kind: "text", text: "You spent $73,781.83" }] },
  } as Parameters<typeof browserNotificationMessage>[0];
  setHideAmounts(true);
  expect(browserNotificationMessage(event, "Finance").body).toBe("You spent $•••");
  setHideAmounts(false);
  expect(browserNotificationMessage(event, "Finance").body).toBe("You spent $73,781.83");
});

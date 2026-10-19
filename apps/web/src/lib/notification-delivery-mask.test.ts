import { afterEach, expect, it } from "vitest";
import { setHideAmounts } from "./hide-amounts-preference";
import { attentionFromDto } from "./notification-delivery";

afterEach(() => setHideAmounts(false));

it("masks currency amounts in the toast and OS text while amounts are hidden", () => {
  const n = {
    id: "n1",
    botId: null,
    surface: "finance",
    threadId: null,
    title: "Runway is $73,781.83",
    body: "You spent $73,781.83",
    link: "/app/finance",
    importance: "attention" as const,
    createdAt: "2030-01-01T00:00:00.000Z",
    seenAt: null,
    shownAt: null,
  };
  setHideAmounts(true);
  expect(attentionFromDto(n)).toMatchObject({ title: "Runway is $•••", body: "You spent $•••" });
  setHideAmounts(false);
  expect(attentionFromDto(n).body).toBe("You spent $73,781.83");
});

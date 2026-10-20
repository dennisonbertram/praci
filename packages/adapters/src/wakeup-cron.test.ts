import { parseCronItems, parseCrontab } from "graphile-worker";
import { describe, expect, it } from "vitest";
import { RECURRING_JOBS } from "./wakeup.js";

describe("RECURRING_JOBS", () => {
  it("parses with graphile-worker even though task names contain dots", () => {
    // Crontab text rejects dotted task names, which stopped the worker from starting.
    expect(() => parseCrontab("* * * * * notifications.deliver")).toThrow(/Invalid command/);
    expect(parseCronItems(RECURRING_JOBS).map((item) => item.task)).toEqual([
      "notifications.deliver",
      "notifications.retention",
      "messaging.retention",
      "mail.watch.renew",
    ]);
  });
});
